# VDashboard MVP: Gap Analysis Report

This report compares the provided Functional Requirements (FR) and User Stories (US) against the current state of the VDashboard application implementation. Use this guide to determine which Jira/Azure tickets are already satisfied by the codebase and which remain open.

---

## ✅ COMPLETED: Integrated in Current Codebase

The following features and user stories have been fully (or sufficiently) implemented in the current MVP architecture:

### Epic 1: Supplier Assessment Workflow
* **FR-1.1.3 / US-1.3 View Supplier Profile**: Completed. The system accurately displays the legal name, address, industry, NAICS code, and known subsidiaries directly on the Risk Assessment view.

### Epic 2: Data Collection & Enrichment
* **FR-1.2.1 & 1.2.2 / US-2.1 Aggregate Public Data**: Completed. `public_data_service.py` effectively fetches and normalizes external data from sanctions lists, trade/import records, and recent negative news APIs.
* **FR-1.2.3 / US-2.2 Extract Relationships**: Completed. Parent/subsidiary intelligence mapping is handled and piped directly into the Trust Graph.

### Epic 3: Risk & Compliance Engine
* **FR-1.3.1 / US-3.1 Sanctions Check**: Completed. `sanctions_service.py` evaluates suppliers against OFAC, BIS, and EU configurations. The UI properly labels entities as "Sanctioned."
* **FR-1.3.3 / US-3.2 Section 889 Status**: Completed. `section889_service.py` runs a rule engine checking supplier components vs. covered entity sourcing logs. The frontend properly shows "Pass/Conditional/Fail" labels.
* **FR-1.3.4 / US-3.3 Risk Score Explanation**: Completed. `scoring_engine.py` dynamically calculates the 0-100 score utilizing the external YAML config `scoring_rules.yaml`. The frontend now includes hover tooltips breaking down precisely how factors negatively impacted the supplier's risk score.

### Epic 4: Trust Graph & Multi-tier Visibility
* **FR-1.4.1 - 1.4.3 / US-4.1 - 4.3 View & Filter Trust Graph**: Completed. Graph nodes visually display direct ties to sanctioned entities up to Best-Effort Tier-2. Zooming, panning, and toggling by risk color all actively work on the "TrustGraph" component. Tracing direct exposure paths to primary suppliers is mapped.

### Epic 5: Reporting & History
* **FR-1.5.1 / US-5.1 Generate Assessment Report**: Completed. The frontend Assessment page exports a full human-readable PDF via `jspdf`, grabbing risk summaries, breakdowns, and evidence tables.
* **FR-1.5.3 / US-5.2 View Assessment History**: Completed. Assessment timestamps and the users who triggered the runs (Audit Log) exist functionally on the UI.

---

## ⏳ PENDING: Remaining Work ("To-Do" Backlog)

The following requirements represent active gaps between the breakdown specification and the current codebase. These should be loaded into Jira/Azure boards for the dev team:

### EPIC 1: Onboarding Enhancements
* **[FR-1.1.1 / US-1.1] Advanced Search Filters**: The UI needs extended filter controls in `suppliers/page.tsx` allowing procurement to search specifically by NAICS commodity groupings, Part Numbers, or highly specific City strings.
* **[FR-1.1.2 / US-1.2] Disambiguation List Confirmation UI**: Although `entity_resolution_service.py` exists, the flow needs a user-facing step. If the user searches "Acme", the system must show a selection modal ("Did you mean Acme Inc in USA or Acme Corp in UK?") *before* launching the 2-minute assessment process.

### EPIC 2: Advanced Extraction
* **[FR-1.2.3] Unstructured Documents**: Build an OCR/LLM pipeline to explicitly pull unstructured PDF corporate filings, extract hidden entities, and assign direct "Confidence Scores (0 to 1)" rendered in the UI evidence tables.

### EPIC 5: Advanced History Tools
* **[US-5.3] Historical Assessment Comparison Side-by-Side**: The app currently compares supplier A gracefully against supplier B (`comparison/page.tsx`). A new feature is needed to compare an *older* assessment of Supplier A against a *newer* assessment of Supplier A, showing a visual delta (e.g., Risk score dropped 12 points, 2 new sanctions hits detected).

### EPIC 6: User Security & Data Protection
* **[FR-1.6.2 / US-6.2] Enforced Authorization (Role-Based Access Control)**: Basic JWT login (`auth.py`) is live, but the UI component tree must conditionally hide the entire `/admin` config interface for basic "Viewer" roles. Only Admin profiles should be allowed to modify the weighting inputs that update `scoring_rules.yaml`.

---
*Report Generated: Automated Analysis against current VDashboard MVP source.*
