# Venture-by-Venture Automation Scorecard (v1)

Generated: 2026-03-12
Owner: K

Scoring legend (per automation):
- **Impact**: revenue, cycle-time, quality, or risk reduction
- **Maturity**: 0=none, 1=prototype, 2=operational, 3=scaled with feedback loops
- **Priority**: P0 (now), P1 (next), P2 (later)

---

## 1) Summit (local home services)
### Business bottlenecks
- Trust proof at speed
- Lead response quality
- Consistent before/after content pipeline

### Top automations
1. **Job Media Intake + Website Feed**
   - KPI: % jobs with usable before/after proof
   - Impact: High | Maturity: 2 | Priority: **P0**
2. **Media Review + Approve/Flag workflow**
   - KPI: review turnaround + publish-ready asset rate
   - Impact: High | Maturity: 2 | Priority: **P0**
3. **Quote Follow-up Sequencer**
   - KPI: quote->booked conversion rate
   - Impact: High | Maturity: 1 | Priority: **P1**
4. **Service-area SEO page updater**
   - KPI: local organic traffic + lead form submissions
   - Impact: Med/High | Maturity: 0 | Priority: **P1**
5. **Review-request + testimonial harvesting**
   - KPI: review volume and average rating
   - Impact: High | Maturity: 0 | Priority: **P1**

### Next bot additions
- `summit-quote-followup`
- `summit-local-seo-updater`
- `summit-review-harvester`

---

## 2) Wholesale (real estate wholesaling)
### Business bottlenecks
- Lead triage speed
- Underwriting consistency
- Buyer disposition throughput

### Top automations
1. **Property Media Intake + Condition Tagging**
   - KPI: lead->underwrite latency
   - Impact: High | Maturity: 0 | Priority: **P0**
2. **Deal Underwrite Pack Generator (ARV/repairs/risk)**
   - KPI: underwriting accuracy + offer speed
   - Impact: High | Maturity: 0 | Priority: **P0**
3. **Seller Follow-up Cadence Bot**
   - KPI: contact rate + appointment rate
   - Impact: High | Maturity: 0 | Priority: **P1**
4. **Buyer Blast + Match Scorer**
   - KPI: dispo time + assignment fee consistency
   - Impact: High | Maturity: 0 | Priority: **P1**
5. **Deal Timeline/Compliance Tracker**
   - KPI: fallout rate + closing cycle time
   - Impact: Med/High | Maturity: 0 | Priority: **P1**

### Next bot additions
- `wholesale-property-intake`
- `wholesale-underwrite-desk`
- `wholesale-buyer-match`

---

## 3) GateReady (retail product)
### Business bottlenecks
- Product conversion
- Policy confusion friction
- Creative performance drift

### Top automations
1. **Product Asset Library + Variant Testing**
   - KPI: CTR + conversion by creative family
   - Impact: High | Maturity: 1 | Priority: **P0**
2. **Policy-fit content validator**
   - KPI: reduction in policy-confusion support inquiries
   - Impact: High | Maturity: 1 | Priority: **P0**
3. **PDP optimization loop (copy/image ordering)**
   - KPI: add-to-cart and checkout conversion lift
   - Impact: High | Maturity: 0 | Priority: **P1**
4. **UGC ingestion + moderation workflow**
   - KPI: approved UGC volume + conversion lift
   - Impact: Med/High | Maturity: 0 | Priority: **P1**
5. **Event-window campaign automation**
   - KPI: revenue around event windows
   - Impact: Med/High | Maturity: 0 | Priority: **P2**

### Next bot additions
- `gateready-asset-optimizer`
- `gateready-policy-clarity-bot`
- `gateready-ugc-curator`

---

## 4) EdgeTerminal (insight platform)
### Business bottlenecks
- Insight quality + consistency
- Publishing cadence
- authority-to-conversion bridge

### Top automations
1. **Insight QA + report-grade review**
   - KPI: acceptance rate + engagement depth
   - Impact: High | Maturity: 1 | Priority: **P0**
2. **Research-to-article pipeline**
   - KPI: publish cadence + quality consistency
   - Impact: High | Maturity: 1 | Priority: **P0**
3. **Executive brief generator**
   - KPI: newsletter/brief retention
   - Impact: Med/High | Maturity: 0 | Priority: **P1**
4. **Competitor signal monitoring**
   - KPI: speed-to-commentary on key events
   - Impact: Med | Maturity: 1 | Priority: **P1**
5. **Funnel bridge bot (content -> signup CTA tuning)**
   - KPI: visitor->signup conversion
   - Impact: High | Maturity: 0 | Priority: **P1**

### Next bot additions
- `edgeterminal-insight-qa`
- `edgeterminal-brief-desk`
- `edgeterminal-cadence-manager`

---

## 5) African Storytime (current lane config)
### Business bottlenecks
- Content quality consistency
- retention and narrative strength
- conversion to site ecosystem

### Top automations
1. **Narrative quality reviewer (text+video script)**
   - KPI: completion/retention rates
   - Impact: High | Maturity: 0 | Priority: **P0**
2. **Editorial cadence planner**
   - KPI: consistency + backlog health
   - Impact: Med/High | Maturity: 0 | Priority: **P0**
3. **Visual identity consistency checker**
   - KPI: brand consistency score
   - Impact: Med | Maturity: 0 | Priority: **P1**
4. **Series performance analyzer**
   - KPI: episode-level retention trends
   - Impact: Med/High | Maturity: 0 | Priority: **P1**
5. **Content repurposing engine (short/long/text)**
   - KPI: output per source story
   - Impact: Med/High | Maturity: 0 | Priority: **P2**

### Next bot additions
- `african-storytime-editorial-desk`
- `african-storytime-retention-analyst`
- `african-storytime-repurpose-engine`

---

## Portfolio-level priorities (next 14 days)
### P0 (build now)
1. Summit quote follow-up automation
2. Wholesale property intake + underwriting bot
3. GateReady product-asset optimizer
4. EdgeTerminal insight QA hardening
5. African Storytime narrative QA + cadence planner

### P1 (build next)
1. Cross-venture KPI dashboard normalization
2. Bot command presets in Workspace Lite
3. Approval analytics (override reasons + false-positive/negative tracking)

### P2 (later)
1. Autonomous campaign optimization loops with strict guardrails
2. Cross-venture knowledge graph for reusable playbooks

---

## Governance checkpoints (must-have)
- Every bot must map to one KPI and one business bottleneck.
- No new bot without explicit owner + rollback path.
- Weekly prune: decommission low-ROI automations.
