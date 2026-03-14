import { randomUUID } from "node:crypto";
import { NoopOutboundStore } from "./store-noop";
import { SqliteOutboundStore } from "./store-sqlite";
import { triageInboundMessage } from "./triage";
import { InboundSmsPayload, SmsStatusPayload } from "./types";
import {
  CompositeEscalationNotifier,
  OpenClawCliNotifier,
  WebhookEscalationNotifier,
} from "./notifier";

const store =
  process.env.OUTBOUND_STORE === "sqlite"
    ? new SqliteOutboundStore()
    : new NoopOutboundStore();

const notifier = new CompositeEscalationNotifier([
  new WebhookEscalationNotifier(process.env.OUTBOUND_ESCALATION_WEBHOOK_URL),
  new OpenClawCliNotifier(
    process.env.OUTBOUND_ESCALATION_CHANNEL,
    process.env.OUTBOUND_ESCALATION_TARGET,
  ),
]);

function nowIso(): string {
  return new Date().toISOString();
}

export async function handleInboundSms(payload: InboundSmsPayload): Promise<{ twiml?: string; action: string }> {
  const triage = triageInboundMessage(payload.body);

  await store.appendAudit("InboundReceived", {
    accountId: payload.accountId,
    fromPhone: payload.fromPhone,
    body: payload.body,
    triage,
    at: nowIso(),
  });

  if (triage.type === "SUPPRESS") {
    await store.suppressPhone(payload.accountId, payload.fromPhone, triage.reason);
    await store.pauseMembershipByPhone(payload.accountId, payload.fromPhone, `suppressed:${triage.reason}`);

    const confirmation =
      triage.reason === "stop"
        ? "You’ve been unsubscribed and will not receive more messages."
        : "Thanks for letting us know — we removed this number.";

    return {
      twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
        confirmation,
      )}</Message></Response>`,
      action: `SUPPRESSED_${triage.reason.toUpperCase()}`,
    };
  }

  const membership = await store.getMembershipByPhone(payload.accountId, payload.fromPhone);

  if (triage.type === "ESCALATE") {
    await store.pauseMembershipByPhone(payload.accountId, payload.fromPhone, `escalate:${triage.label}`);
    await store.enqueueJob({
      jobId: randomUUID(),
      jobType: "EscalationRequested",
      runAt: nowIso(),
      payloadJson: {
        accountId: payload.accountId,
        phone: payload.fromPhone,
        body: payload.body,
        intent: triage.label,
        confidence: triage.confidence,
        membership,
      },
      status: "PENDING",
      attempts: 0,
      maxAttempts: 5,
      idempotencyKey: `escalate:${payload.accountId}:${payload.messageSid ?? randomUUID()}`,
    });

    await notifier.notify({
      accountId: payload.accountId,
      leadPhone: payload.fromPhone,
      lastInbound: payload.body,
      intentLabel: triage.label,
      confidence: triage.confidence,
      membership,
    });

    return { action: `ESCALATED_${triage.label}` };
  }

  if (triage.type === "WARM") {
    await store.enqueueJob({
      jobId: randomUUID(),
      jobType: "SwitchToConversation",
      runAt: nowIso(),
      payloadJson: {
        accountId: payload.accountId,
        phone: payload.fromPhone,
        body: payload.body,
        maxQuestions: 1,
      },
      status: "PENDING",
      attempts: 0,
      maxAttempts: 5,
      idempotencyKey: `warm:${payload.accountId}:${payload.messageSid ?? randomUUID()}`,
    });
    return { action: "WARM_CONVERSATION" };
  }

  if (triage.type === "COLD") {
    await store.enqueueJob({
      jobId: randomUUID(),
      jobType: "AdvanceCadence",
      runAt: nowIso(),
      payloadJson: {
        accountId: payload.accountId,
        phone: payload.fromPhone,
        variantMode: "soft",
      },
      status: "PENDING",
      attempts: 0,
      maxAttempts: 5,
      idempotencyKey: `cold:${payload.accountId}:${payload.messageSid ?? randomUUID()}`,
    });
    return { action: "COLD_CONTINUE_CADENCE" };
  }

  await store.enqueueJob({
    jobId: randomUUID(),
    jobType: "LLMFallbackRequested",
    runAt: nowIso(),
    payloadJson: {
      accountId: payload.accountId,
      phone: payload.fromPhone,
      body: payload.body,
      allowedActions: triage.allowedActions,
    },
    status: "PENDING",
    attempts: 0,
    maxAttempts: 3,
    idempotencyKey: `unknown:${payload.accountId}:${payload.messageSid ?? randomUUID()}`,
  });

  return { action: "UNKNOWN_LLM_FALLBACK" };
}

export async function handleSmsStatus(payload: SmsStatusPayload): Promise<void> {
  await store.updateOutboundMessageStatus({
    messageSid: payload.messageSid,
    status: payload.messageStatus,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
  });

  await store.appendAudit("OutboundStatusUpdated", {
    accountId: payload.accountId,
    messageSid: payload.messageSid,
    messageStatus: payload.messageStatus,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
    at: nowIso(),
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
