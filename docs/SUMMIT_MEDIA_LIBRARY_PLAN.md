# Summit Media Library Plan (v1)

## Why this matters
Photos are a core growth asset in local home services: trust proof, before/after conversion, ad creatives, website proof, and review follow-up.

## Recommendation
Yes: maintain a **photo library per business**.

- Each business has different brand, privacy rules, and content strategy.
- Keep shared architecture, but separate media indexes by venture.

## Structure
- `state/summit-media/<date>/<jobId>/...`
- `state/summit-media-index.jsonl`
- `state/summit-media-review.jsonl`

## Required metadata per image
- venture, jobId, stage (before/during/after)
- service type
- zone/service area
- timestamp
- privacyChecked
- websiteReady

## Key downstream uses
1. Website galleries / case-study modules
2. Social content (before/after posts)
3. Sales proof in quotes/proposals
4. QA evidence and crew coaching
5. Review-request follow-up assets

## Missed opportunities to capture now
- Add a shot list per job (street, close-up, full facade, problem area, final result)
- Track which images convert best by service type
- Auto-suggest website case studies from highest-quality jobs
- Build seasonal portfolio packs (spring clean, roof wash, siding, driveway)

## Next implementation step
- Add `summit-media-export-site.mjs` to produce website-ready JSON feeds for the site under construction.
