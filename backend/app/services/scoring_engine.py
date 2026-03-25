import yaml
import os
from typing import Dict, Any, Tuple, List

# Define the absolute path to the configuration file (root of backend)
CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scoring_rules.yaml")

class ScoringEngine:
    """
    Engine that evaluates risk scores based on an externalized YAML configuration.
    Features live-reload capabilities (loads fresh from disk on each evaluation or dynamically).
    """

    @staticmethod
    def _load_config() -> Dict[str, Any]:
        """Loads the YAML configuration file."""
        if not os.path.exists(CONFIG_PATH):
            # Fallback default if file is somehow missing
            return {
                "version": "v1.0-default",
                "max_score": 100,
                "thresholds": {"fail": 75, "conditional": 40},
                "rules": {}
            }
        
        with open(CONFIG_PATH, "r") as config_file:
            return yaml.safe_load(config_file)

    @staticmethod
    def calculate_risk_score(context: Dict[str, Any]) -> Tuple[int, str, List[Dict[str, Any]], str]:
        """
        Calculates the risk score given a context of extracted intelligence.
        Returns: (total_score, status, detailed_breakdown, version)
        """
        from app.database import SessionLocal
        from app.models import ScoringConfig
        
        # 1. Load active config from DB if available
        db = SessionLocal()
        db_config = db.query(ScoringConfig).filter(ScoringConfig.active == True).first()
        db.close()
        
        # 2. Load YAML config as fallback/defaults
        yaml_config = ScoringEngine._load_config()
        rules = yaml_config.get("rules", {})
        sanctions_rules = rules.get("sanctions", {})
        
        # Override weights if DB config exists
        sanctions_hit_weight = db_config.sanctions_weight if db_config else sanctions_rules.get("hit", {}).get("weight", 70)
        s889_fail_weight = db_config.section889_fail_weight if db_config else sanctions_rules.get("section_889_fail", {}).get("weight", 30)
        s889_cond_weight = db_config.section889_conditional_weight if db_config else sanctions_rules.get("section_889_conditional", {}).get("weight", 15)
        
        version = db_config.version if db_config else yaml_config.get("version", "unknown")
        
        total_score = 0
        factors = []
        
        # 3. Sanctions Risk
        if context.get("sanctions_hit"):
            weight = sanctions_hit_weight
            reason = sanctions_rules.get("hit", {}).get("reason", "Active sanctions match")
            total_score += weight
            factors.append({
                "key": "sanctions",
                "label": "Sanctions & Watchlists",
                "weight": weight,
                "max_points": weight,
                "points": weight,
                "triggered": True,
                "reason": reason
            })
            
        # Section 889
        s889_status = context.get("section_889_status")
        if s889_status == "FAIL":
            weight = s889_fail_weight
            reason = context.get("section_889_reason") or sanctions_rules.get("section_889_fail", {}).get("reason", "Section 889 Fail")
            total_score += weight
            factors.append({
                "key": "section_889",
                "label": "Section 889 Compliance",
                "weight": weight,
                "max_points": weight,
                "points": weight,
                "triggered": True,
                "reason": reason
            })
        elif s889_status == "CONDITIONAL":
            weight = s889_cond_weight
            reason = context.get("section_889_reason") or sanctions_rules.get("section_889_conditional", {}).get("reason", "Section 889 Conditional")
            total_score += weight
            factors.append({
                "key": "section_889",
                "label": "Section 889 Compliance",
                "weight": weight,
                "max_points": weight,
                "points": weight,
                "triggered": True,
                "reason": reason
            })

        # 2. Geographic Risk
        geo_rules = rules.get("geographic_risk", {})
        country = context.get("country", "").upper()
        if country:
            country_matched = False
            for level, data in geo_rules.items():
                if country in data.get("countries", []):
                    weight = data.get("weight", 0)
                    reason = data.get("reason", f"Risk from jurisdiction {country}")
                    total_score += weight
                    factors.append({
                        "key": "geographic_risk",
                        "label": "Geographic Risk",
                        "weight": weight,
                        "max_points": weight,
                        "points": weight,
                        "triggered": True,
                        "reason": f"({country}) {reason}"
                    })
                    country_matched = True
                    break
            
            if not country_matched:
                factors.append({
                    "key": "geographic_risk",
                    "label": "Geographic Risk",
                    "weight": 0,
                    "max_points": 40,
                    "points": 0,
                    "triggered": False,
                    "reason": "Entity not in a high or medium risk jurisdiction"
                })
        else:
             factors.append({
                "key": "geographic_risk",
                "label": "Geographic Risk",
                "weight": 0,
                "max_points": 40,
                "points": 0,
                "triggered": False,
                "reason": "Country information unavailable"
            })

        # 3. Data Gaps
        data_gaps_rules = rules.get("data_gaps", {})
        gap_points = 0
        gap_reasons = []
        
        if context.get("unknown_sub_tiers"):
            weight = data_gaps_rules.get("unknown_sub_tiers", {}).get("weight", 15)
            gap_points += weight
            gap_reasons.append(data_gaps_rules.get("unknown_sub_tiers", {}).get("reason", "Unknown sub-tiers"))
            
        if not context.get("address"):
            weight = data_gaps_rules.get("missing_address", {}).get("weight", 5)
            gap_points += weight
            gap_reasons.append(data_gaps_rules.get("missing_address", {}).get("reason", "Missing address"))
            
        if not context.get("industry"):
            weight = data_gaps_rules.get("missing_industry", {}).get("weight", 5)
            gap_points += weight
            gap_reasons.append(data_gaps_rules.get("missing_industry", {}).get("reason", "Missing industry"))
            
        if gap_points > 0:
            total_score += gap_points
            factors.append({
                "key": "data_gaps",
                "label": "Data Gaps",
                "weight": gap_points,
                "max_points": 25,
                "points": gap_points,
                "triggered": True,
                "reason": "; ".join(gap_reasons)
            })
        else:
             factors.append({
                "key": "data_gaps",
                "label": "Data Gaps",
                "weight": 0,
                "max_points": 25,
                "points": 0,
                "triggered": False,
                "reason": "Sufficient data profile available"
            })

        # 4. Adverse News
        news_rules = rules.get("adverse_news", {})
        news_signal_score = context.get("news_signal_score", 0)
        
        if news_signal_score > 0:
            assigned_weight = 0
            assigned_reason = ""
            for level in ["severe", "moderate", "minor"]:
                data = news_rules.get(level, {})
                if news_signal_score >= data.get("threshold", 999):
                    assigned_weight = data.get("weight", 0)
                    assigned_reason = data.get("reason", "Adverse news found")
                    break
            
            if assigned_weight > 0:
                total_score += assigned_weight
                factors.append({
                    "key": "adverse_news",
                    "label": "Negative Media Signal",
                    "weight": assigned_weight,
                    "max_points": news_rules.get("severe", {}).get("weight", 50),
                    "points": assigned_weight,
                    "triggered": True,
                    "reason": f"(Raw Signal: {news_signal_score}) {assigned_reason}"
                })
        else:
            factors.append({
                "key": "adverse_news",
                "label": "Negative Media Signal",
                "weight": 0,
                "max_points": news_rules.get("severe", {}).get("weight", 50),
                "points": 0,
                "triggered": False,
                "reason": "No adverse media signaling detected"
            })

        # 5. Network Risk (Graph)
        network_rules = rules.get("network_risk", {})
        graph_risk_score = context.get("graph_risk_score", 0)
        
        if graph_risk_score > 0:
            assigned_weight = 0
            assigned_reason = ""
            for level in ["high_impact", "medium_impact"]:
                data = network_rules.get(level, {})
                if graph_risk_score >= data.get("threshold", 999):
                    assigned_weight = data.get("weight", 0)
                    assigned_reason = data.get("reason", "Network exposure detected")
                    break
                    
            if assigned_weight > 0:
                 total_score += assigned_weight
                 factors.append({
                     "key": "network_risk",
                     "label": "Network & Graph Risk",
                     "weight": assigned_weight,
                     "max_points": network_rules.get("high_impact", {}).get("weight", 50),
                     "points": assigned_weight,
                     "triggered": True,
                     "reason": f"(Graph Risk: {graph_risk_score}) {assigned_reason}"
                 })
        else:
            factors.append({
                 "key": "network_risk",
                 "label": "Network & Graph Risk",
                 "weight": 0,
                 "max_points": network_rules.get("high_impact", {}).get("weight", 50),
                 "points": 0,
                 "triggered": False,
                 "reason": "No elevated risk from entity network relationships"
             })

        # Cap the total score
        max_score = yaml_config.get("max_score", 100)
        total_score = min(total_score, max_score)

        # Determine overall status
        status = "PASS"
        if total_score >= yaml_config.get("thresholds", {}).get("fail", 75):
            status = "FAIL"
        elif total_score >= yaml_config.get("thresholds", {}).get("conditional", 40):
            status = "CONDITIONAL"

        return total_score, status, factors, yaml_config.get("version", "unknown")
