# Buffer Production Line (No Copy/Paste)

## Objective
Run social publishing as an automated production line from approved content to live posts.

## Pipeline
1. `trend-intel-generate` creates required Pre-Post Intelligence Pack.
2. `content-review-intel` marks approved renders in DB.
3. `buffer-sync-queue` moves approved renders into `state/buffer-publish-queue.jsonl` **only when an intelligence pack exists**.
4. `buffer-publish-worker` publishes queue items to Buffer API (or dryrun).
4. Logs written to `state/buffer-published.jsonl`.
5. Mission Control reads queue/logs for monitoring.

## Required env
- `BUFFER_ACCESS_TOKEN`
- `BUFFER_PROFILE_MAP` JSON map, e.g.:
  {
    "summit:facebook": "<profile_id>",
    "summit:instagram": "<profile_id>",
    "gateready:instagram": "<profile_id>",
    "edgeterminal:x": "<profile_id>"
  }

## Commands
- Generate intelligence pack:
  `npm run trend:intel -- --venture summit`
- Queue approved content:
  `npm run buffer:sync -- --venture summit --platform facebook --limit 25`
- Publish queue:
  `npm run buffer:publish -- --mode live --max 10`
- Dryrun publish:
  `npm run buffer:publish -- --mode dryrun --max 10`

## Safety
- Start in dryrun mode first.
- Keep human approval in content review phase.
- Monitor failed queue items and fix profile map gaps.
