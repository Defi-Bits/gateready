import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const CFG = join(ROOT, "config", "security-chief.json");

export function readChiefConfig() {
  try {
    return JSON.parse(readFileSync(CFG, "utf8"));
  } catch {
    return {
      identity: { name: "Security Chief", emoji: "🛡️", voice: "concise, risk-aware, action-first" },
      routing: { channel: "telegram", target: process.env.SECURITY_CHIEF_CHAT_ID ?? "5000492604" },
      alerts: { minSeverityForPush: "warn" }
    };
  }
}
