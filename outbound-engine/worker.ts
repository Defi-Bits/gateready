import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sendSmsViaTwilio } from "./twilio-transport";
import type { DurableWorkerDbAdapter, JobRecord, MembershipRecord } from "./db-adapter";

const execFileAsync = promisify(execFile);

export async function reconciler(db: DurableWorkerDbAdapter, nowIso: string) {
  const releasedLocks = await db.releaseStaleLocks(nowIso);
  const enqueuedCatchup = await db.enqueueOverdueTouchesWithCatchup(nowIso);
  await db.verifySuppressionIntegrity();
  return { releasedLocks, enqueuedCatchup };
}

export async function workerTick(db: DurableWorkerDbAdapter, workerId: string) {
  const job = await db.claimNextDueJob(workerId);
  if (!job) return { status: "IDLE" as const };

  try {
    const alreadyDone = await db.hasIdempotentSuccess(job.idempotency_key);
    if (alreadyDone) {
      await db.markJobDone(job.job_id);
      return { status: "SKIPPED_ALREADY_DONE" as const, jobId: job.job_id };
    }

    await executeJob(db, job);
    await db.writeIdempotencySuccess(job.idempotency_key, job.job_id);
    await db.markJobDone(job.job_id);
    return { status: "DONE" as const, jobId: job.job_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    const exhausted = job.attempts >= job.max_attempts;

    if (!exhausted) {
      const retryAtIso = computeRetryAtIso(job.attempts);
      await db.rescheduleJob(job.job_id, retryAtIso, message);
      return {
        status: "RETRY_SCHEDULED" as const,
        jobId: job.job_id,
        error: message,
        retryAt: retryAtIso,
      };
    }

    if (job.job_type === "CriticalReportDispatch") {
      const reportType = asString(job.payload_json.reportType) ?? "unknown";
      const payload = {
        ...job.payload_json,
        reportType,
        failedJobId: job.job_id,
        failedAt: new Date().toISOString(),
        failureReason: message,
      };
      await db.enqueueJob(
        "CriticalReportEscalate",
        new Date().toISOString(),
        payload,
        `critical:escalate:${reportType}:${randomUUID()}`,
        1,
      );
    }

    await db.markJobFailure(job.job_id, message, "DEAD");
    return {
      status: "DEAD" as const,
      jobId: job.job_id,
      error: message,
    };
  }
}

async function executeJob(db: DurableWorkerDbAdapter, job: JobRecord) {
  switch (job.job_type) {
    case "TouchDue":
      await executeTouchDue(db, job);
      return;
    case "OutboundSendRequested":
      await executeOutboundSendRequested(db, job);
      return;
    case "InboundReceived":
    case "EscalationRequested":
    case "SwitchToConversation":
    case "AdvanceCadence":
    case "LLMFallbackRequested":
      return;
    case "CriticalReportDispatch":
      await executeCriticalReportDispatch(db, job);
      return;
    case "CriticalReportEscalate":
      await executeCriticalReportEscalate(db, job);
      return;
    default:
      throw new Error(`unsupported_job_type:${job.job_type}`);
  }
}

async function executeTouchDue(db: DurableWorkerDbAdapter, job: JobRecord) {
  const payload = job.payload_json;
  const membershipId = asString(payload.membershipId);
  if (!membershipId) {
    throw new Error("touchdue_missing_membershipId");
  }

  const membership = await db.getMembershipById(membershipId);
  if (!membership) {
    await db.appendAudit("TouchDueSkipped", { reason: "membership_not_found", membershipId, jobId: job.job_id });
    return;
  }

  if (membership.mode !== "cadence") {
    await db.appendAudit("TouchDueSkipped", {
      reason: "membership_not_cadence",
      membershipId,
      mode: membership.mode,
      jobId: job.job_id,
    });
    return;
  }

  const suppressed = await db.isSuppressed(membership.account_id, membership.lead_phone);
  if (suppressed) {
    await db.updateMembershipAfterTouch({
      membershipId,
      nextStepIndex: membership.step_index,
      nextTouchAtIso: null,
      nextMode: "closed",
      touchedAtIso: new Date().toISOString(),
    });
    await db.appendAudit("Suppressed", {
      accountId: membership.account_id,
      phone: membership.lead_phone,
      membershipId,
      reason: "suppression_hit_during_touchdue",
    });
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const sendWindow = resolveSendWindow(payload);
  if (!isWithinSendWindow(now, sendWindow.startHour, sendWindow.endHour)) {
    const nextRun = nextWindowIso(now, sendWindow.startHour);
    await db.enqueueJob(
      "TouchDue",
      nextRun,
      { ...payload, membershipId, rescheduledFromJobId: job.job_id },
      `touchdue:window:${membershipId}:${bucket(nextRun)}`,
    );
    await db.appendAudit("TouchDueRescheduled", {
      reason: "outside_send_window",
      membershipId,
      nextRun,
      accountId: membership.account_id,
    });
    return;
  }

  const cooldownMinutes = asNumber(payload.cooldownMinutes, 60);
  if (membership.last_touch_at) {
    const elapsedMs = now.getTime() - new Date(membership.last_touch_at).getTime();
    if (elapsedMs < cooldownMinutes * 60_000) {
      const nextRun = new Date(new Date(membership.last_touch_at).getTime() + cooldownMinutes * 60_000).toISOString();
      await db.enqueueJob(
        "TouchDue",
        nextRun,
        { ...payload, membershipId, rescheduledFromJobId: job.job_id },
        `touchdue:cooldown:${membershipId}:${bucket(nextRun)}`,
      );
      await db.appendAudit("TouchDueRescheduled", {
        reason: "cooldown",
        membershipId,
        cooldownMinutes,
        nextRun,
        accountId: membership.account_id,
      });
      return;
    }
  }

  const templateId = pickTemplateId(membership, payload);
  await db.appendAudit("OutboundSendRequested", {
    accountId: membership.account_id,
    membershipId,
    phone: membership.lead_phone,
    campaignName: membership.campaign_name,
    stepIndex: membership.step_index,
    templateId,
  });

  await db.enqueueJob(
    "OutboundSendRequested",
    nowIso,
    {
      accountId: membership.account_id,
      membershipId,
      toPhone: membership.lead_phone,
      templateId,
      stepIndex: membership.step_index,
    },
    `sendreq:${membershipId}:${membership.step_index}:${bucket(nowIso)}`,
  );

  const cadenceHours = parseCadenceHours(payload);
  const maxSteps = asNumber(payload.maxSteps, cadenceHours.length + 1);
  const nextStepIndex = membership.step_index + 1;
  const shouldClose = nextStepIndex >= maxSteps;
  const nextTouchAtIso = shouldClose ? null : new Date(now.getTime() + cadenceHours[Math.min(membership.step_index, cadenceHours.length - 1)] * 3600_000).toISOString();

  await db.updateMembershipAfterTouch({
    membershipId,
    nextStepIndex,
    nextTouchAtIso,
    nextMode: shouldClose ? "closed" : "cadence",
    touchedAtIso: nowIso,
  });

  if (!shouldClose && nextTouchAtIso) {
    await db.enqueueJob(
      "TouchDue",
      nextTouchAtIso,
      { ...payload, membershipId },
      `touchdue:next:${membershipId}:${nextStepIndex}:${bucket(nextTouchAtIso)}`,
    );
  }
}

async function executeOutboundSendRequested(db: DurableWorkerDbAdapter, job: JobRecord) {
  const twilioEnabled = (process.env.OUTBOUND_TWILIO_ENABLED ?? "false").toLowerCase() === "true";
  if (!twilioEnabled) {
    await db.appendAudit("OutboundSkipped", {
      reason: "twilio_disabled",
      jobId: job.job_id,
      at: new Date().toISOString(),
    });
    return;
  }

  const payload = job.payload_json;
  const accountId = asString(payload.accountId);
  const membershipId = asString(payload.membershipId);
  const toPhone = asString(payload.toPhone);
  if (!accountId || !membershipId || !toPhone) {
    throw new Error("sendreq_missing_fields");
  }

  const templateId = asString(payload.templateId) ?? "default_template";
  const body = asString(payload.body) ?? `Hi — quick follow up from Kwasi re: ${templateId}.`;
  const statusCallbackUrl = process.env.OUTBOUND_TWILIO_STATUS_CALLBACK_URL;

  const sent = await sendSmsViaTwilio({
    accountId,
    toPhone,
    body,
    statusCallbackUrl,
  });

  if (!sent.ok || !sent.messageSid) {
    await db.appendAudit("OutboundFailed", {
      accountId,
      membershipId,
      toPhone,
      templateId,
      error: sent.error ?? "unknown_send_error",
      jobId: job.job_id,
    });
    throw new Error(`twilio_send_failed:${sent.error ?? "unknown"}`);
  }

  await db.recordOutboundMessage({
    messageSid: sent.messageSid,
    accountId,
    membershipId,
    toPhone,
    status: sent.status ?? "queued",
    body,
    templateId,
  });

  await db.appendAudit("OutboundSent", {
    accountId,
    membershipId,
    toPhone,
    templateId,
    messageSid: sent.messageSid,
    status: sent.status ?? "queued",
    jobId: job.job_id,
  });
}

async function executeCriticalReportDispatch(db: DurableWorkerDbAdapter, job: JobRecord) {
  const payload = job.payload_json;
  const reportType = asString(payload.reportType) ?? "unknown";
  const severity = asString(payload.severity) ?? "critical";
  const message = asString(payload.message);
  if (!message) {
    throw new Error("critical_report_missing_message");
  }

  const primaryChannel = asString(payload.primaryChannel) ?? process.env.CRITICAL_REPORT_PRIMARY_CHANNEL;
  const primaryTarget = asString(payload.primaryTarget) ?? process.env.CRITICAL_REPORT_PRIMARY_TARGET;
  const fallbackChannels = asStringArray(payload.fallbackChannels);
  const fallbackTargets = asStringArray(payload.fallbackTargets);

  const route = buildChannelRoute(primaryChannel, primaryTarget, fallbackChannels, fallbackTargets);
  if (route.length === 0) {
    throw new Error("critical_report_missing_route");
  }

  const routeIndex = Math.min(Math.max(job.attempts - 1, 0), route.length - 1);
  const currentRoute = route[routeIndex];

  await sendOpenClawMessage(currentRoute.channel, currentRoute.target, message);

  await db.appendAudit("CriticalReportDelivered", {
    reportType,
    severity,
    channel: currentRoute.channel,
    target: currentRoute.target,
    attempt: job.attempts,
    jobId: job.job_id,
  });
}

async function executeCriticalReportEscalate(db: DurableWorkerDbAdapter, job: JobRecord) {
  const payload = job.payload_json;
  const reportType = asString(payload.reportType) ?? "unknown";
  const failureReason = asString(payload.failureReason) ?? "unknown_error";
  const failedJobId = asString(payload.failedJobId) ?? job.job_id;
  const severity = asString(payload.severity) ?? "critical";

  const channel = process.env.CRITICAL_REPORT_ESCALATION_CHANNEL ?? process.env.CRITICAL_REPORT_PRIMARY_CHANNEL;
  const target = process.env.CRITICAL_REPORT_ESCALATION_TARGET ?? process.env.CRITICAL_REPORT_PRIMARY_TARGET;

  if (channel && target) {
    const text = [
      "🚨 Critical report delivery exhausted retries",
      `report: ${reportType}`,
      `severity: ${severity}`,
      `failedJobId: ${failedJobId}`,
      `reason: ${failureReason}`,
      "action: check queue dead-letter jobs and provider/channel status",
    ].join("\n");
    await sendOpenClawMessage(channel, target, text);
  }

  await db.appendAudit("CriticalReportEscalated", {
    reportType,
    severity,
    failureReason,
    failedJobId,
    escalatedAt: new Date().toISOString(),
    jobId: job.job_id,
  });
}

function pickTemplateId(membership: MembershipRecord, payload: Record<string, unknown>): string {
  const stepTemplates = (payload.stepTemplates ?? {}) as Record<string, unknown>;
  const key = String(membership.step_index);
  const listRaw = Array.isArray(stepTemplates[key]) ? (stepTemplates[key] as unknown[]) : [];
  const list = listRaw.map((x) => String(x)).filter(Boolean);
  const fallback = (payload.templatePool as unknown[] | undefined)?.map((x) => String(x)).filter(Boolean) ?? [];
  const pool = list.length > 0 ? list : fallback;
  if (pool.length === 0) return `default_step_${membership.step_index}`;

  const idx = deterministicIndex(`${membership.membership_id}:${membership.step_index}`, pool.length);
  return pool[idx] ?? pool[0];
}

function deterministicIndex(seed: string, mod: number): number {
  const h = createHash("sha256").update(seed).digest("hex");
  const n = parseInt(h.slice(0, 8), 16);
  return mod === 0 ? 0 : n % mod;
}

function parseCadenceHours(payload: Record<string, unknown>): number[] {
  const raw = payload.cadenceHours;
  if (!Array.isArray(raw)) return [24, 72, 120];
  const out = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  return out.length > 0 ? out : [24, 72, 120];
}

function resolveSendWindow(payload: Record<string, unknown>): { startHour: number; endHour: number } {
  const startHour = asNumber((payload.sendWindow as Record<string, unknown> | undefined)?.startHour, 9);
  const endHour = asNumber((payload.sendWindow as Record<string, unknown> | undefined)?.endHour, 19);
  return { startHour, endHour };
}

function isWithinSendWindow(now: Date, startHour: number, endHour: number): boolean {
  const h = now.getHours();
  return h >= startHour && h < endHour;
}

function nextWindowIso(now: Date, startHour: number): string {
  const d = new Date(now);
  d.setHours(startHour, 0, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function bucket(iso: string): string {
  return iso.slice(0, 13);
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function asNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function computeRetryAtIso(attempt: number): string {
  const backoffMinutes = [2, 5, 15, 30, 60];
  const idx = Math.min(Math.max(attempt - 1, 0), backoffMinutes.length - 1);
  const minutes = backoffMinutes[idx] ?? 60;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function buildChannelRoute(
  primaryChannel: string | null | undefined,
  primaryTarget: string | null | undefined,
  fallbackChannels: string[],
  fallbackTargets: string[],
): Array<{ channel: string; target: string }> {
  const route: Array<{ channel: string; target: string }> = [];
  if (primaryChannel && primaryTarget) {
    route.push({ channel: primaryChannel, target: primaryTarget });
  }

  for (let i = 0; i < fallbackChannels.length; i++) {
    const channel = fallbackChannels[i];
    const target = fallbackTargets[i] ?? primaryTarget ?? "";
    if (channel && target) route.push({ channel, target });
  }

  return route;
}

async function sendOpenClawMessage(channel: string, target: string, message: string): Promise<void> {
  const binary = process.env.OPENCLAW_BIN ?? "openclaw";
  await execFileAsync(binary, [
    "message",
    "send",
    "--channel",
    channel,
    "--target",
    target,
    "--message",
    message,
  ]);
}
