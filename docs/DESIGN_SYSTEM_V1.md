# Design System v1 (Mission Control)

## Tokens
- Spacing scale: 4, 8, 12, 16, 24, 32
- Radius scale: 8, 12, 16
- Typography:
  - Display: 24/32 semibold
  - Heading: 18/26 semibold
  - Body: 14/22 regular
  - Meta: 12/18 medium

## Color semantics
- Background: neutral deep slate
- Surface: elevated slate tiers
- Text: high/medium/low contrast tiers
- Status:
  - success (green)
  - warning (amber)
  - danger (red)
  - info (blue)

## Components (v1 required)
1. App shell (top bar, left nav, content pane)
2. Context switcher (venture + environment lock)
3. KPI tile (value, delta, confidence)
4. Command card (action, inputs, guardrails, run)
5. Approval table (score, risk flags, rationale, decision)
6. Activity timeline (audit trail)
7. Empty/error states with recovery CTA

## Interaction rules
- Buttons have clear primary/secondary hierarchy
- Long-running actions show staged progress
- Actions return structured result cards (not raw logs by default)
- Keyboard shortcuts for core operations (later phase)

## Accessibility baseline
- Contrast AA minimum
- Focus-visible states on all interactive controls
- Hit target >= 40px for primary controls
