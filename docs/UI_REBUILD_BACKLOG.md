# UI Rebuild Backlog (ranked)

## Phase 1 — Foundation (P0)
1. **App shell redesign**
   - Add left navigation + persistent venture context bar
   - Success: operator can navigate all major functions without scrolling hunt
2. **Command Center redesign**
   - Group actions by workflow stage (intel -> review -> approval -> publish)
   - Success: full chain run clarity and guardrails visible
3. **Approval queue redesign**
   - Table-first UX with rationale, score, risk flags, quick actions
   - Success: approve/reject in <30 sec/item

## Phase 2 — Workspace intelligence (P1)
4. **Media library experience**
   - Filters, timeline mode, publish state chips, job drill-down
5. **Automation backlog panel**
   - Read `state/automation-priority-queue.jsonl` with status updates
6. **Result cards**
   - Replace raw JSON output with structured summaries + expandable raw logs

## Phase 3 — Premium polish (P2)
7. **Interaction polish**
   - Loading skeletons, subtle transitions, optimistic updates
8. **Data visualization**
   - Trend sparklines for score/confidence/approval rates
9. **Operator personalization**
   - Saved views, presets, shortcut actions

## Build order for next session
- Rebuild app shell + command center first.
