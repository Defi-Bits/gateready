import { IntentLabel } from "./types";

const STOP_PATTERNS = /\b(stop|unsubscribe|end|do not contact|dnc|remove me)\b/i;
const WRONG_NUMBER_PATTERNS = /\b(wrong number|not .*person|don'?t know .*|no .*here)\b/i;
const LEGAL_PATTERNS = /\b(lawyer|attorney|sue|lawsuit|legal|harassment|report you|cease)\b/i;
const HOT_PATTERNS = /\b(offer|price|how much|call me|let'?s talk|interested|when can you)\b/i;
const WARM_PATTERNS = /\b(maybe|not now|later|how does this work|more info|details)\b/i;
const COLD_PATTERNS = /\b(not interested|no thanks|no thank you|go away)\b/i;

export type TriageAction =
  | { action: "SUPPRESS"; reason: "stop" | "wrong_number" }
  | { action: "PAUSE_AND_ESCALATE"; reason: "angry_legal"; intent: IntentLabel; confidence: number }
  | { action: "ESCALATE_HOT"; intent: "HOT"; confidence: number }
  | { action: "SWITCH_TO_CONVERSATION"; intent: "WARM"; confidence: number; maxQuestions: 1 }
  | { action: "CONTINUE_CADENCE"; intent: "COLD"; confidence: number; soften: true }
  | { action: "LLM_FALLBACK"; intent: "UNKNOWN"; confidence: number; allowedActions: string[] };

export function triageInbound(text: string): TriageAction {
  const body = text.trim();

  if (STOP_PATTERNS.test(body)) return { action: "SUPPRESS", reason: "stop" };
  if (WRONG_NUMBER_PATTERNS.test(body)) return { action: "SUPPRESS", reason: "wrong_number" };
  if (LEGAL_PATTERNS.test(body)) {
    return { action: "PAUSE_AND_ESCALATE", reason: "angry_legal", intent: "ANGRY_LEGAL", confidence: 0.99 };
  }
  if (HOT_PATTERNS.test(body)) return { action: "ESCALATE_HOT", intent: "HOT", confidence: 0.9 };
  if (WARM_PATTERNS.test(body)) {
    return { action: "SWITCH_TO_CONVERSATION", intent: "WARM", confidence: 0.8, maxQuestions: 1 };
  }
  if (COLD_PATTERNS.test(body)) {
    return { action: "CONTINUE_CADENCE", intent: "COLD", confidence: 0.75, soften: true };
  }

  return {
    action: "LLM_FALLBACK",
    intent: "UNKNOWN",
    confidence: 0.4,
    allowedActions: ["intent_classify", "extract_constraints", "draft_1line_reply"],
  };
}
