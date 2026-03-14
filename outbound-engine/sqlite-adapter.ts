import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import type { DurableWorkerDbAdapter, JobRecord, MembershipRecord } from "./db-adapter";

export class SqliteDurableWorkerAdapter implements DurableWorkerDbAdapter {
  private readonly db: DatabaseSync;

  constructor(dbPath?: string) {
    const path = dbPath ?? process.env.OUTBOUND_SQLITE_PATH ?? join(process.cwd(), "outbound-engine", "outbound.db");
    this.db = new DatabaseSync(path);
  }

  async claimNextDueJob(workerId: string): Promise<JobRecord | null> {
    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare(
          `SELECT job_id, job_type, payload_json, idempotency_key, attempts, max_attempts
           FROM jobs
           WHERE status='PENDING' AND run_at <= ?
           ORDER BY run_at ASC
           LIMIT 1`
        )
        .get(now) as
        | {
            job_id: string;
            job_type: string;
            payload_json: string;
            idempotency_key: string;
            attempts: number;
            max_attempts: number;
          }
        | undefined;

      if (!row) {
        this.db.exec("COMMIT");
        return null;
      }

      const nextAttempts = Number(row.attempts ?? 0) + 1;
      this.db
        .prepare(
          `UPDATE jobs
           SET status='RUNNING', locked_at=?, locked_by=?, attempts=?
           WHERE job_id=?`
        )
        .run(now, workerId, nextAttempts, row.job_id);

      this.db.exec("COMMIT");

      return {
        job_id: row.job_id,
        job_type: row.job_type,
        payload_json: parseJson(row.payload_json),
        idempotency_key: row.idempotency_key,
        attempts: nextAttempts,
        max_attempts: Number(row.max_attempts ?? 0),
      };
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  async hasIdempotentSuccess(key: string): Promise<boolean> {
    const row = this.db
      .prepare(`SELECT 1 as ok FROM idempotency WHERE idempotency_key=? AND status='SUCCESS' LIMIT 1`)
      .get(key) as { ok: number } | undefined;
    return Boolean(row?.ok);
  }

  async writeIdempotencySuccess(key: string, resultRef: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO idempotency (idempotency_key, status, result_ref, created_at)
         VALUES (?, 'SUCCESS', ?, ?)
         ON CONFLICT(idempotency_key)
         DO UPDATE SET status='SUCCESS', result_ref=excluded.result_ref`
      )
      .run(key, resultRef, new Date().toISOString());
  }

  async markJobDone(jobId: string): Promise<void> {
    this.db
      .prepare(`UPDATE jobs SET status='DONE', locked_at=NULL, locked_by=NULL, last_error=NULL WHERE job_id=?`)
      .run(jobId);
  }

  async markJobFailure(jobId: string, error: string, status: "FAILED" | "DEAD"): Promise<void> {
    this.db
      .prepare(`UPDATE jobs SET status=?, last_error=?, locked_at=NULL, locked_by=NULL WHERE job_id=?`)
      .run(status, error, jobId);
  }

  async rescheduleJob(jobId: string, nextRunAtIso: string, error: string): Promise<void> {
    this.db
      .prepare(
        `UPDATE jobs
         SET status='PENDING', run_at=?, last_error=?, locked_at=NULL, locked_by=NULL
         WHERE job_id=?`
      )
      .run(nextRunAtIso, error, jobId);
  }

  async releaseStaleLocks(nowIso: string): Promise<number> {
    this.db
      .prepare(
        `UPDATE jobs
         SET status='PENDING', locked_at=NULL, locked_by=NULL
         WHERE status='RUNNING' AND datetime(locked_at) < datetime(?, '-2 minutes')`
      )
      .run(nowIso);

    const row = this.db.prepare("SELECT changes() as changes").get() as { changes: number };
    return Number(row?.changes ?? 0);
  }

  async enqueueOverdueTouchesWithCatchup(_nowIso: string): Promise<number> {
    return 0;
  }

  async verifySuppressionIntegrity(): Promise<void> {
    return;
  }

  async appendAudit(eventType: string, payloadJson: Record<string, unknown>): Promise<void> {
    this.db
      .prepare(`INSERT INTO audit_log (event_type, payload_json, created_at) VALUES (?, ?, ?)`)
      .run(eventType, JSON.stringify(payloadJson), new Date().toISOString());
  }

  async enqueueJob(
    jobType: string,
    runAtIso: string,
    payloadJson: Record<string, unknown>,
    idempotencyKey: string,
    maxAttempts = 5,
  ): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO jobs
         (job_id, job_type, run_at, payload_json, status, attempts, max_attempts, idempotency_key)
         VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?)`
      )
      .run(randomUUID(), jobType, runAtIso, JSON.stringify(payloadJson), maxAttempts, idempotencyKey);
  }

  async getMembershipById(membershipId: string): Promise<MembershipRecord | null> {
    const row = this.db
      .prepare(
        `SELECT membership_id, account_id, lead_phone, campaign_name, step_index, mode, touch_count, last_touch_at, next_touch_at
         FROM campaign_membership
         WHERE membership_id=?
         LIMIT 1`
      )
      .get(membershipId) as MembershipRecord | undefined;
    return row ?? null;
  }

  async isSuppressed(accountId: string, phone: string): Promise<boolean> {
    const row = this.db
      .prepare(`SELECT 1 as ok FROM suppression WHERE account_id=? AND phone=? LIMIT 1`)
      .get(accountId, phone) as { ok: number } | undefined;
    return Boolean(row?.ok);
  }

  async updateMembershipAfterTouch(args: {
    membershipId: string;
    nextStepIndex: number;
    nextTouchAtIso: string | null;
    nextMode: "cadence" | "closed";
    touchedAtIso: string;
  }): Promise<void> {
    this.db
      .prepare(
        `UPDATE campaign_membership
         SET step_index=?,
             next_touch_at=?,
             mode=?,
             last_touch_at=?,
             touch_count=touch_count+1
         WHERE membership_id=?`
      )
      .run(args.nextStepIndex, args.nextTouchAtIso, args.nextMode, args.touchedAtIso, args.membershipId);
  }

  async recordOutboundMessage(args: {
    messageSid: string;
    accountId: string;
    membershipId: string;
    toPhone: string;
    status: string;
    body: string;
    templateId: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO outbound_message
         (message_sid, account_id, membership_id, to_phone, status, body, template_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(message_sid)
         DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`
      )
      .run(
        args.messageSid,
        args.accountId,
        args.membershipId,
        args.toPhone,
        args.status,
        args.body,
        args.templateId,
        now,
        now,
      );
  }

  async updateOutboundMessageStatus(args: {
    messageSid: string;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<void> {
    this.db
      .prepare(
        `UPDATE outbound_message
         SET status=?, error_code=?, error_message=?, updated_at=?
         WHERE message_sid=?`
      )
      .run(args.status, args.errorCode ?? null, args.errorMessage ?? null, new Date().toISOString(), args.messageSid);
  }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}
