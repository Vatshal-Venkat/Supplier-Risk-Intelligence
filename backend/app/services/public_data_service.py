"""
Public Data Aggregation Service
================================
Aggregates freely available public data for supplier due diligence:
  1. Sanctions & Watchlists  (OFAC SDN, BIS Entity List, EU Consolidated)
  2. Trade / Import Records  (US Census Foreign Trade)
  3. Corporate Filings       (SEC EDGAR full-text search)
  4. Recent News             (GNews free tier)
"""

import os
import csv
import io
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Optional
import requests
from rapidfuzz import fuzz

# ─── Config ───────────────────────────────────────────

GNEWS_API_KEY = os.getenv("GNEWS_API_KEY", "")
SEC_EDGAR_UA = os.getenv("SEC_EDGAR_USER_AGENT", "VDashboard admin@example.com")

MATCH_THRESHOLD = 82  # fuzzy-match cutoff for sanctions screening

# ─── Helpers ──────────────────────────────────────────

def _normalize(text: str) -> str:
    return text.lower().replace(",", "").replace(".", "").replace("-", "").strip()


def _safe_get(url: str, headers: dict | None = None, params: dict | None = None,
              timeout: int = 20) -> requests.Response | None:
    """HTTP GET with built-in error swallowing — never lets a network issue crash the pipeline."""
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp
    except Exception as e:
        print(f"⚠️  public_data_service HTTP error: {e}")
        return None


# =====================================================
# 1.  SANCTIONS & WATCHLISTS
# =====================================================

_OFAC_SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"
_BIS_ENTITY_URL = (
    "https://www.bis.doc.gov/index.php/documents/"
    "consolidated-entity-list/1072-el-entity-list-csv/file"
)
_EU_SANCTIONS_URL = (
    "https://webgate.ec.europa.eu/fsd/fsf/public/files/"
    "xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw"
)


def _screen_ofac(name: str) -> list[dict]:
    """Download OFAC SDN CSV and fuzzy-match against supplier name."""
    hits: list[dict] = []
    resp = _safe_get(_OFAC_SDN_URL, timeout=30)
    if not resp:
        return hits

    norm = _normalize(name)
    reader = csv.reader(io.StringIO(resp.text))

    for row in reader:
        if len(row) < 2:
            continue
        sdn_name = row[1].strip()
        if not sdn_name:
            continue
        score = fuzz.token_set_ratio(norm, _normalize(sdn_name))
        if score >= MATCH_THRESHOLD:
            hits.append({
                "list": "OFAC SDN",
                "matched_name": sdn_name,
                "match_score": score,
                "sdn_type": row[2].strip() if len(row) > 2 else "",
                "program": row[3].strip() if len(row) > 3 else "",
                "reference_url": "https://sanctionssearch.ofac.treas.gov/",
            })
    return hits


def _screen_bis(name: str) -> list[dict]:
    """Download BIS Entity List CSV and fuzzy-match."""
    hits: list[dict] = []
    resp = _safe_get(_BIS_ENTITY_URL, timeout=30)
    if not resp:
        return hits

    norm = _normalize(name)
    reader = csv.reader(io.StringIO(resp.text))
    header = next(reader, None)

    for row in reader:
        if not row:
            continue
        entity_name = row[0].strip()
        if not entity_name:
            continue
        score = fuzz.token_set_ratio(norm, _normalize(entity_name))
        if score >= MATCH_THRESHOLD:
            hits.append({
                "list": "BIS Entity List",
                "matched_name": entity_name,
                "match_score": score,
                "country": row[1].strip() if len(row) > 1 else "",
                "license_requirement": row[2].strip() if len(row) > 2 else "",
                "reference_url": "https://www.bis.doc.gov/index.php/the-denied-persons-list",
            })
    return hits


def _screen_eu(name: str) -> list[dict]:
    """Download EU Consolidated Sanctions XML and fuzzy-match."""
    hits: list[dict] = []
    resp = _safe_get(_EU_SANCTIONS_URL, timeout=30)
    if not resp:
        return hits

    norm = _normalize(name)
    try:
        root = ET.fromstring(resp.content)
        # EU XML namespace
        ns = {"eu": "http://eu.europa.ec/fpi/fsd/export"}
        for entity in root.iter():
            if entity.tag.endswith("nameAlias") or entity.tag.endswith("wholeName"):
                eu_name = entity.text or entity.get("wholeName", "")
                if not eu_name:
                    continue
                score = fuzz.token_set_ratio(norm, _normalize(eu_name))
                if score >= MATCH_THRESHOLD:
                    hits.append({
                        "list": "EU Consolidated Sanctions",
                        "matched_name": eu_name,
                        "match_score": score,
                        "reference_url": "https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions",
                    })
    except ET.ParseError:
        print("⚠️  Failed to parse EU sanctions XML")

    return hits


def check_sanctions_lists(name: str, country: str = "") -> dict:
    """
    Screen supplier name against OFAC SDN, BIS Entity List, and EU sanctions.
    Returns structured results with match details.
    """
    ofac_hits = _screen_ofac(name)
    bis_hits = _screen_bis(name)
    eu_hits = _screen_eu(name)

    all_hits = ofac_hits + bis_hits + eu_hits
    flagged = len(all_hits) > 0

    return {
        "flagged": flagged,
        "total_hits": len(all_hits),
        "hits": all_hits,
        "lists_checked": ["OFAC SDN", "BIS Entity List", "EU Consolidated Sanctions"],
        "checked_at": datetime.utcnow().isoformat(),
    }


# =====================================================
# 2.  TRADE / IMPORT RECORDS
# =====================================================

_CENSUS_TRADE_URL = "https://api.census.gov/data/timeseries/intltrade/imports/hs"


def search_trade_records(name: str, country: str = "") -> dict:
    """
    Query US Census International Trade data for import records.
    Falls back to summary-level data if detailed data is unavailable.
    """
    records: list[dict] = []

    # US Census trade API is free, no key required
    # We search by country HS-level imports as a proxy signal
    if not country:
        return {
            "available": False,
            "reason": "Country not provided — cannot query trade records",
            "records": [],
            "source": "US Census Bureau International Trade",
            "checked_at": datetime.utcnow().isoformat(),
        }

    # Map common country names to 2-letter ISO codes for Census API
    country_upper = country.upper().strip()
    
    params = {
        "get": "CTY_NAME,GEN_VAL_MO,CON_VAL_MO",
        "time": "2024",
        "CTY_NAME": country_upper,
    }

    resp = _safe_get(_CENSUS_TRADE_URL, params=params, timeout=15)

    if resp:
        try:
            data = resp.json()
            if isinstance(data, list) and len(data) > 1:
                headers = data[0]
                for row in data[1:6]:  # limit to 5 records
                    record = dict(zip(headers, row))
                    records.append({
                        "country": record.get("CTY_NAME", ""),
                        "general_value": record.get("GEN_VAL_MO", ""),
                        "consumption_value": record.get("CON_VAL_MO", ""),
                        "period": record.get("time", ""),
                    })
        except Exception:
            pass

    return {
        "available": len(records) > 0,
        "total_records": len(records),
        "records": records,
        "source": "US Census Bureau International Trade",
        "reference_url": "https://www.census.gov/foreign-trade/data/index.html",
        "checked_at": datetime.utcnow().isoformat(),
    }


# =====================================================
# 3.  CORPORATE FILINGS (SEC EDGAR)
# =====================================================

_SEC_EFTS_URL = "https://efts.sec.gov/LATEST/search-index"
_SEC_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"
_SEC_COMPANY_URL = "https://www.sec.gov/cgi-bin/browse-edgar"
_SEC_FULLTEXT_URL = "https://efts.sec.gov/LATEST/search-index"


def search_corporate_filings(name: str) -> dict:
    """
    Search SEC EDGAR for corporate filings mentioning the supplier.
    Uses the free EDGAR full-text search API.
    """
    filings: list[dict] = []

    # EDGAR full-text search API (EFTS)
    search_url = "https://efts.sec.gov/LATEST/search-index"
    params = {
        "q": f'"{name}"',
        "dateRange": "custom",
        "startdt": (datetime.utcnow() - timedelta(days=730)).strftime("%Y-%m-%d"),
        "enddt": datetime.utcnow().strftime("%Y-%m-%d"),
        "forms": "10-K,10-Q,8-K,20-F,6-K",
    }
    headers = {"User-Agent": SEC_EDGAR_UA}

    # Try the newer EDGAR full-text search endpoint
    resp = _safe_get(
        "https://efts.sec.gov/LATEST/search-index",
        headers=headers,
        params=params,
        timeout=15,
    )

    # Fallback: use the company search endpoint
    if not resp or resp.status_code != 200:
        resp = _safe_get(
            "https://www.sec.gov/cgi-bin/browse-edgar",
            headers=headers,
            params={
                "company": name,
                "CIK": "",
                "type": "10-K",
                "dateb": "",
                "owner": "include",
                "count": "10",
                "search_text": "",
                "action": "getcompany",
                "output": "atom",
            },
            timeout=15,
        )

        if resp:
            try:
                # Parse Atom feed
                root = ET.fromstring(resp.content)
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                for entry in root.findall("atom:entry", ns)[:10]:
                    title = entry.find("atom:title", ns)
                    link = entry.find("atom:link", ns)
                    updated = entry.find("atom:updated", ns)
                    summary = entry.find("atom:summary", ns)

                    filings.append({
                        "title": title.text if title is not None else "Unknown",
                        "type": "SEC Filing",
                        "date": updated.text[:10] if updated is not None else "",
                        "url": link.get("href", "") if link is not None else "",
                        "summary": (summary.text[:200] if summary is not None and summary.text else ""),
                    })
            except ET.ParseError:
                pass
    else:
        try:
            data = resp.json()
            for hit in data.get("hits", {}).get("hits", [])[:10]:
                source = hit.get("_source", {})
                filings.append({
                    "title": source.get("file_description", "SEC Filing"),
                    "type": source.get("form_type", ""),
                    "date": source.get("file_date", ""),
                    "url": f"https://www.sec.gov/Archives/edgar/data/{source.get('file_num', '')}",
                    "summary": source.get("file_description", "")[:200],
                })
        except Exception:
            pass

    return {
        "available": len(filings) > 0,
        "total_filings": len(filings),
        "filings": filings,
        "source": "SEC EDGAR",
        "reference_url": f"https://www.sec.gov/cgi-bin/browse-edgar?company={name}&CIK=&type=&dateb=&owner=include&count=40&search_text=&action=getcompany",
        "checked_at": datetime.utcnow().isoformat(),
    }


# =====================================================
# 4.  RECENT NEWS (GNews Free Tier)
# =====================================================

def search_recent_news(name: str, months: int = 12) -> dict:
    """
    Search for recent news about the supplier using GNews free API.
    Free tier: 100 requests/day, 10 articles per request.
    """
    articles: list[dict] = []

    if not GNEWS_API_KEY:
        return {
            "available": False,
            "reason": "GNEWS_API_KEY not configured",
            "articles": [],
            "source": "GNews",
            "checked_at": datetime.utcnow().isoformat(),
        }

    from_date = (datetime.utcnow() - timedelta(days=months * 30)).strftime("%Y-%m-%dT%H:%M:%SZ")

    resp = _safe_get(
        "https://gnews.io/api/v4/search",
        params={
            "q": name,
            "lang": "en",
            "max": "10",
            "from": from_date,
            "apikey": GNEWS_API_KEY,
        },
        timeout=15,
    )

    risk_keywords = [
        "fraud", "sanction", "corruption", "bribery", "lawsuit",
        "violation", "penalty", "fine", "investigation", "indictment",
        "embargo", "seizure", "default", "bankruptcy", "money laundering",
    ]

    if resp:
        try:
            data = resp.json()
            for article in data.get("articles", []):
                title = article.get("title", "")
                description = article.get("description", "")
                content_text = f"{title} {description}".lower()

                # Flag risk-relevant articles
                risk_flags = [kw for kw in risk_keywords if kw in content_text]

                articles.append({
                    "title": title,
                    "description": description[:300] if description else "",
                    "source": article.get("source", {}).get("name", "Unknown"),
                    "url": article.get("url", ""),
                    "published_at": article.get("publishedAt", ""),
                    "image": article.get("image", ""),
                    "risk_relevant": len(risk_flags) > 0,
                    "risk_keywords": risk_flags,
                })
        except Exception:
            pass

    risk_count = sum(1 for a in articles if a.get("risk_relevant"))

    return {
        "available": len(articles) > 0,
        "total_articles": len(articles),
        "risk_relevant_count": risk_count,
        "articles": articles,
        "source": "GNews",
        "time_window_months": months,
        "checked_at": datetime.utcnow().isoformat(),
    }


# =====================================================
# MASTER AGGREGATOR
# =====================================================

def aggregate_public_data(name: str, country: str = "", news_months: int = 12) -> dict:
    """
    Aggregate all four public data categories for a supplier.
    Each category is fetched independently — if one fails, the rest still return.
    """
    return {
        "supplier_name": name,
        "country": country,
        "sanctions": check_sanctions_lists(name, country),
        "trade_records": search_trade_records(name, country),
        "corporate_filings": search_corporate_filings(name),
        "news": search_recent_news(name, news_months),
        "aggregated_at": datetime.utcnow().isoformat(),
    }
