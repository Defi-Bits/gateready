# Media Library Architecture (Cross-Venture)

## Decision
Maintain **a separate media library per venture** with a shared schema and shared tooling.

## Why
- Different compliance/privacy policies per business
- Different content and website usage patterns
- Cleaner context boundaries for bot automation

## Standard layout
- `state/<venture>-media/` (files)
- `state/<venture>-media-index.jsonl` (index)
- `state/<venture>-media-review.jsonl` (review queue)
- `state/<venture>-media-site-feed.json` (site export)

## Shared metadata
- `venture`, `mediaId`, `jobId`, `stage`, `serviceType`, `zone`, `crew`, `ts`
- `privacyChecked`, `websiteReady`, `flag`, `publishState`

## Publish states
- `drafted` -> `approved` -> `exported` -> `published` -> `archived`

## Bot pattern
1. Intake bot ingests + indexes
2. Review bot tags/flags and marks readiness
3. Export bot writes website feed JSON
4. Website consumes feed

## Expansion plan
- Add GateReady media intake/export
- Add EdgeTerminal media intake/export
- Keep a common command surface in Workspace Lite Bot CLI Console
