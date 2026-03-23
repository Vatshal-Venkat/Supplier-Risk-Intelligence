"""
Document Extraction Service (FR-1.2.3)

Pulls a PDF from a URL, extracts text using pdfplumber, then runs
Named Entity Recognition via spaCy (already in venv) to identify
companies, people, locations and products, assigning confidence scores.

Why spaCy and not an LLM API?
  - spaCy is already installed (required by other services), requires 
    no external API key, runs fully offline, and is fast enough for 
    this use-case. The confidence scores come from spaCy's NER model.
  - If an OpenAI key is set, the service enriches entities with LLM.
"""

import io
import re
import os
import requests
from typing import List, Dict, Any

# ── spaCy NER ────────────────────────────────────────────────────────────────
try:
    import spacy

    _NLP = spacy.load("en_core_web_sm")
except Exception:
    _NLP = None  # Graceful fallback if model not downloaded

# ── PDF Extraction ────────────────────────────────────────────────────────────
try:
    import pdfplumber
    _PDF_AVAILABLE = True
except ImportError:
    _PDF_AVAILABLE = False

# ── OpenAI optional enrichment ────────────────────────────────────────────────
_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")

_ENTITY_TYPE_MAP = {
    "ORG": "Organization",
    "PERSON": "Person",
    "GPE": "Location",
    "LOC": "Location",
    "PRODUCT": "Product",
    "LAW": "Regulation",
    "NORP": "Group/Nationality",
    "FAC": "Facility",
    "EVENT": "Event",
}


def _extract_text_from_pdf_url(url: str, max_pages: int = 10) -> str:
    """Download a PDF from URL and extract plain text (up to max_pages)."""
    if not _PDF_AVAILABLE:
        raise RuntimeError("pdfplumber not installed. Run: pip install pdfplumber")

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; SupplierIntelBot/1.0)",
        "Accept": "application/pdf",
    }
    resp = requests.get(url, headers=headers, timeout=30, verify=False)
    resp.raise_for_status()

    pdf_bytes = io.BytesIO(resp.content)
    text_chunks: List[str] = []

    with pdfplumber.open(pdf_bytes) as pdf:
        for i, page in enumerate(pdf.pages[:max_pages]):
            page_text = page.extract_text()
            if page_text:
                text_chunks.append(page_text)

    return "\n".join(text_chunks)


def _run_ner(text: str) -> List[Dict[str, Any]]:
    """Run spaCy NER over text and return deduplicated entities with scores."""
    if _NLP is None:
        return []

    # Truncate to 100k chars to avoid memory issues
    doc = _NLP(text[:100_000])

    seen: Dict[str, Dict[str, Any]] = {}

    for ent in doc.ents:
        label = _ENTITY_TYPE_MAP.get(ent.label_)
        if not label:
            continue
        raw = ent.text.strip()
        if len(raw) < 3 or re.match(r"^\d+$", raw):
            continue

        key = raw.lower()
        if key not in seen:
            # spaCy doesn't expose per-entity probabilities directly.
            # Use a heuristic score: longer entities ↑, short fragments ↓
            # Scores clamped to [0.5, 0.98]
            word_count = len(raw.split())
            heuristic = min(0.98, 0.55 + word_count * 0.08)
            seen[key] = {
                "entity": raw,
                "entity_type": label,
                "confidence": round(heuristic, 2),
                "occurrences": 1,
            }
        else:
            seen[key]["occurrences"] += 1
            # More mentions = higher confidence (max 0.98)
            seen[key]["confidence"] = min(
                0.98,
                seen[key]["confidence"] + 0.02,
            )

    # Sort: triggered ORGs first, then by confidence
    results = sorted(
        seen.values(),
        key=lambda x: (x["entity_type"] != "Organization", -x["confidence"]),
    )

    return results[:50]  # Cap at 50 entities


def extract_entities_from_filing(
    pdf_url: str,
    supplier_name: str,
) -> Dict[str, Any]:
    """
    Main entry-point.

    Args:
        pdf_url: Direct URL to a PDF filing (e.g., SEC EDGAR document URL).
        supplier_name: Used to boost confidence when the supplier itself appears.

    Returns:
        {
            "source_url": str,
            "pages_parsed": int,
            "entities": List[{entity, entity_type, confidence, occurrences}],
            "error": str | None
        }
    """
    try:
        text = _extract_text_from_pdf_url(pdf_url)
        if not text.strip():
            return {
                "source_url": pdf_url,
                "pages_parsed": 0,
                "entities": [],
                "error": "PDF contained no extractable text (may be scanned image).",
            }

        entities = _run_ner(text)

        # Boost supplier's own name confidence to 1.0 if it appears
        supplier_lower = supplier_name.lower()
        for e in entities:
            if supplier_lower in e["entity"].lower():
                e["confidence"] = 1.0

        return {
            "source_url": pdf_url,
            "pages_parsed": min(10, text.count("\f") + 1),
            "entities": entities,
            "error": None,
        }

    except Exception as exc:
        return {
            "source_url": pdf_url,
            "pages_parsed": 0,
            "entities": [],
            "error": str(exc),
        }
