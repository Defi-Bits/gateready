import type { AccountId, EngineJob, MembershipContext, OutboundStore } from "./types";
import { getOutboundSqlite } from "./sqlite";

export class SqliteOutboundStore implements OutboundStore {
  async appendAudit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const db = getOutboundSqlite();
    db.prepare(
      `INSERT INTO audit_log (event_type, payload_json, created_at) VALUES (?, ?, ?)`
    ).run(eventType, JSON.stringify(payload), new Date().toISOString());
  }

  async suppressPhone(accountId: AccountId, phone: string, reason: "stop" | "wrong_number"): Promise<void> {
    const db = getOutboundSqlite();
    db.prepare(
      `INSERT INTO suppression (phone, account_id, reason, suppressed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(phone, account_id)
       DO UPDATE SET reason=excluded.reason, suppressed_at=excluded.suppressed_at`
    ).run(phone, accountId, reason, new Date().toISOString());
  }

  async pauseMembershipByPhone(accountId: AccountId, phone: string, reason: string): Promise<void> {
    const db = getOutboundSqlite();
    db.prepare(
      `UPDATE campaign_membership
       SET mode='suppressed'
       WHERE account_id=? AND lead_phone=? AND mode <> 'closed'`
    ).run(accountId, phone);

    await this.appendAudit("AutomationPaused", { accountId, phone, reason });
  }

  async enqueueJob(job: EngineJob): Promise<void> {
    const db = getOutboundSqlite();
    db.prepare(
      `INSERT OR IGNORE INTO jobs
       (job_id, job_type, run_at, payload_json, status, attempts, max_attempts, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      job.jobId,
      job.jobType,
      job.runAt,
      JSON.stringify(job.payloadJson),
      job.status,
      job.attempts,
      job.maxAttempts,
      job.idempotencyKey,
    );
  }

  async getMembershipByPhone(accountId: AccountId, phone: string): Promise<MembershipContext | null> {
    const db = getOutboundSqlite();
    const row = db
      .prepare(
        `SELECT membership_id, campaign_name, step_index, mode
         FROM campaign_membership
         WHERE account_id=? AND lead_phone=?
         ORDER BY last_touch_at DESC
         LIMIT 1`
      )
      .get(accountId, phone) as
      | { membership_id: string; campaign_name: string; step_index: number; mode: MembershipContext["mode"] }
      | undefined;

    if (!row) return null;
    return {
      membershipId: row.membership_id,
      campaignName: row.campaign_name,
      stepIndex: row.step_index,
      mode: row.mode,
    };
  }

  async updateOutboundMessageStatus(args: {
    messageSid: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    const db = getOutboundSqlite();
    db.prepare(
      `UPDATE outbound_message
       SET status=?, error_code=?, error_message=?, updated_at=?
       WHERE message_sid=?`
    ).run(
      args.status,
      args.errorCode ?? null,
      args.errorMessage ?? null,
      new Date().toISOString(),
      args.messageSid,
    );
  }
}
