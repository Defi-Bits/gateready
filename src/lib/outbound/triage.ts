export type TriageResult =
  | { type: "SUPPRESS"; reason: "stop" | "wrong_number" }
  | { type: "ESCALATE"; label: "HOT" | "ANGRY_LEGAL"; confidence: number }
  | { type: "WARM"; confidence: number }
  | { type: "COLD"; confidence: number }
  | { type: "UNKNOWN"; confidence: number; allowedActions: string[] };

const STOP_PATTERNS = /\b(stop|unsubscribe|end|do not contact|dnc|remove me)\b/i;
const WRONG_NUMBER_PATTERNS = /\b(wrong number|not .*person|don'?t know .*|no .*here)\b/i;
const LEGAL_PATTERNS = /\b(lawyer|attorney|sue|lawsuit|legal|harassment|cease)\b/i;
const HOT_PATTERNS = /\b(offer|price|how much|call me|interested|when can you)\b/i;
const WARM_PATTERNS = /\b(maybe|not now|later|more info|details|how does this work)\b/i;
const COLD_PATTERNS = /\b(not interested|no thanks|no thank you)\b/i;

export function triageInboundMessage(body: string): TriageResult {
  if (STOP_PATTERNS.test(body)) return { type: "SUPPRESS", reason: "stop" };
  if (WRONG_NUMBER_PATTERNS.test(body)) return { type: "SUPPRESS", reason: "wrong_number" };
  if (LEGAL_PATTERNS.test(body)) return { type: "ESCALATE", label: "ANGRY_LEGAL", confidence: 0.99 };
  if (HOT_PATTERNS.test(body)) return { type: "ESCALATE", label: "HOT", confidence: 0.9 };
  if (WARM_PATTERNS.test(body)) return { type: "WARM", confidence: 0.8 };
  if (COLD_PATTERNS.test(body)) return { type: "COLD", confidence: 0.75 };
  return {
    type: "UNKNOWN",
    confidence: 0.4,
    allowedActions: ["intent_classify", "extract_constraints", "draft_1line_reply"],
  };
}
