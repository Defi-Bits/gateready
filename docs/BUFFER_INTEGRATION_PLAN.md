# Buffer Integration Plan (v1)

## Role split
- **Mission Control**: strategy, drafting, review, approvals, guardrails
- **Buffer**: scheduling and publishing transport

## Ventures in scope (phase 1)
- summit
- gateready
- edgeterminal

## Launch cadence (starting point)
- summit: 1 post/day (before/after, local tips, trust proof)
- gateready: 2 posts/day (product assets, policy clarity, UGC)
- edgeterminal: 1 post/day (insights, charts, report snippets)

## Approval flow
1. Drafts produced in Mission Control
2. Content Review Intel scores + tags
3. Human approves
4. Export Buffer-ready CSV
5. Import to Buffer queue per channel/account

## Guardrails
- No unverifiable claims
- Respect venture-specific media-intent policy
- High-risk claims always human-approved

## Weekly loop
- Pull Buffer analytics
- Compare against reviewer scores
- Update venture rubrics and content categories

## Immediate setup checklist
- [ ] Connect venture social accounts in Buffer
- [ ] Create Buffer queues per venture
- [ ] Use `npm run buffer:export` from mission-control
- [ ] Import CSV into Buffer
- [ ] Track first 2 weeks KPI baseline
