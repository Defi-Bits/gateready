import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AccountId, MembershipContext } from "./types";

const execFileAsync = promisify(execFile);

export interface EscalationPayload {
  accountId: AccountId;
  leadPhone: string;
  lastInbound: string;
  intentLabel: "HOT" | "ANGRY_LEGAL";
  confidence: number;
  membership: MembershipContext | null;
}

export interface EscalationNotifier {
  notify(payload: EscalationPayload): Promise<void>;
}

export class WebhookEscalationNotifier implements EscalationNotifier {
  constructor(private readonly webhookUrl?: string) {}

  async notify(payload: EscalationPayload): Promise<void> {
    if (!this.webhookUrl) return;

    await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "EscalationRequested",
        urgency: payload.intentLabel === "ANGRY_LEGAL" ? "critical" : "high",
        brief: buildBrief(payload),
      }),
    });
  }
}

export class OpenClawCliNotifier implements EscalationNotifier {
  constructor(
    private readonly channel?: string,
    private readonly target?: string,
    private readonly binary = process.env.OPENCLAW_BIN ?? "openclaw",
  ) {}

  async notify(payload: EscalationPayload): Promise<void> {
    if (!this.channel || !this.target) return;

    const brief = buildBrief(payload);
    const text = [
      `🚨 ${brief.intent_label} lead (${brief.campaign_name})`,
      `Phone: ${brief.lead_phone}`,
      `Step: ${brief.campaign_step}`,
      `Inbound: ${brief.last_inbound_message}`,
      `Next: ${brief.suggested_next_message}`,
      `Call opener: ${brief.suggested_call_opener}`,
    ].join("\n");

    await execFileAsync(this.binary, [
      "message",
      "send",
      "--channel",
      this.channel,
      "--target",
      this.target,
      "--message",
      text,
    ]);
  }
}

export class CompositeEscalationNotifier implements EscalationNotifier {
  constructor(private readonly notifiers: EscalationNotifier[]) {}

  async notify(payload: EscalationPayload): Promise<void> {
    if (this.notifiers.length === 0) {
      console.log("[outbound.escalation]", buildBrief(payload));
      return;
    }

    for (const notifier of this.notifiers) {
      try {
        await notifier.notify(payload);
      } catch (err) {
        console.error("[outbound.escalation.notify_error]", err);
      }
    }
  }
}

function buildBrief(payload: EscalationPayload) {
  return {
    lead_phone: payload.leadPhone,
    campaign_name: payload.membership?.campaignName ?? "unknown",
    campaign_step: payload.membership?.stepIndex ?? -1,
    intent_label: payload.intentLabel,
    confidence: payload.confidence,
    last_inbound_message: payload.lastInbound,
    suggested_next_message:
      payload.intentLabel === "ANGRY_LEGAL"
        ? "Thanks for flagging this. We’ve paused outreach to this number immediately."
        : "Thanks for the reply — Kwasi can connect with you directly. What’s the best time today?",
    suggested_call_opener:
      payload.intentLabel === "ANGRY_LEGAL"
        ? "I’m calling to confirm we’ve removed your number and won’t contact you again."
        : "Thanks for replying — I wanted to quickly understand your timeline and expectations.",
    constraints: {},
  };
}
