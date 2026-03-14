# Posture Decision: Gateway Trusted Proxies

Decision date: 2026-03-06
Owner: Security Chief

## Decision
Keep OpenClaw Control UI **local-only** (loopback) for now.

## Rationale
- Current bind is loopback and no reverse proxy is in active use.
- Setting trusted proxies is unnecessary unless proxying is introduced.
- Lower exposure while security controls mature.

## Trigger to revisit
If Control UI is exposed through a reverse proxy, immediately configure:
- `gateway.trustedProxies` with exact proxy IPs/CIDRs
- re-run `openclaw security audit --deep`

## Current status
- `openclaw security audit --deep`: 0 critical, 1 warning (trusted proxies), acceptable under local-only policy.
