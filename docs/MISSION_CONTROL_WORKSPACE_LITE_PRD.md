# Mission Control Workspace Lite (v1 PRD)

## Goal
Create a secure, web-accessible internal workspace for K’s businesses that centralizes docs, content review, pipelines, and operational visibility from anywhere.

## Design Principles
1. Portfolio-native: built around multi-lane businesses (current + future)
2. Bot-native: every major object can be read/written by bots with audit trails
3. Local-first architecture, cloud-ready deployment
4. Explicit approval controls for external actions
5. Security by default (least privilege, strong auth, full logs)

## Core Information Architecture

### 1) Portfolio Home
- Today’s priorities
- Lane health cards
- Alerts (security, SLA, queue failures)
- Recent bot actions

### 2) Lanes
- Each lane has:
  - Objectives
  - KPI board
  - Active projects
  - Content pipeline
  - Ops issues

### 3) Docs
- Rich text notes + SOPs + runbooks
- Tagged by lane and type
- Version history (simple snapshots)

### 4) Content Studio
- Draft queue
- Review decisions (`approve/rewrite/reject`)
- Post preview and scheduling states
- Review board view (from `content-review-intel` outputs)

### 5) Data Tables (Sheet-like)
- Leads/opportunities table
- Content performance table
- Task/owner table
- Filter/sort/group + CSV import/export

### 6) PDF Vault
- Upload PDFs
- Extract text + searchable index
- Attach PDFs to lanes/projects/docs

## Canonical Data Model (v1)
- `lanes`
- `projects`
- `docs`
- `doc_versions`
- `content_items`
- `content_reviews`
- `content_publications`
- `tables` / `table_rows`
- `files`
- `audit_events`

## Access & Security
- Auth required for all pages (Clerk already present)
- Role tiers: owner, operator, reviewer, viewer
- Every bot write includes actor + timestamp + source
- Sensitive actions require confirmation gates

## Global Access ("anywhere in the world")
- Deploy Mission Control site to a secure cloud host (e.g., Vercel)
- Keep runtime workers and secrets server-side
- Use HTTPS + strong auth + optional MFA
- Do NOT expose local OpenClaw control endpoints publicly

## Bot Integration Contract
Each bot writes structured events to app-readable stores:
- Content Review Intel -> `content_reviews`
- Security Chief -> risk events + remediation tasks
- Outreach Ops -> queue states + approval statuses
- COO -> priorities + handoff actions

## Delivery Phases

### Phase 1 (2 weeks): Foundation
- Portfolio Home
- Lane pages
- Docs v1 (create/read/edit)
- Content Review Board view
- Auth + basic roles

### Phase 2 (2-3 weeks): Operations
- Data tables v1
- PDF vault + extraction/search
- Content Studio workflow integration
- Audit timeline UI

### Phase 3 (2 weeks): Intelligence
- KPI trend dashboards
- Quality drift reporting for content reviewer
- Cross-lane portfolio weekly memo page

## Out of Scope (v1)
- Real-time multiplayer doc editing (Google Docs parity)
- Full spreadsheet formula engine parity
- Public sharing links and guest collaboration

## Success Metrics
- Daily active usage by owner/operators
- Time-to-find key business info < 2 min
- Content review cycle time reduced by 30%+
- Fewer missed approvals / fewer policy violations

## Immediate Next Build Tasks
1. Add `workspace-lite` nav section in Mission Control UI
2. Build Portfolio Home page with lane cards + alerts
3. Add Content Review Board page reading:
   - `mission-control/state/content-review-board.md`
   - `mission-control/state/content-review-decisions.jsonl`
4. Build Docs v1 CRUD (lane-tagged)
5. Build deployment plan doc for secure global access
