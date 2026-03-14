import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { DurableWorkerDbAdapter, JobRecord, MembershipRecord } from "./db-adapter";

type PgQueryResult = { rows: Record<string, unknown>[]; rowCount: number };
type PgLikeClient = {
  connect: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<PgQueryResult>;
  end: () => Promise<void>;
};

/**
 * PostgreSQL adapter skeleton.
 * Uses runtime require so the app can run without pg installed in UI-only mode.
 */
export class PostgresDurableWorkerAdapter implements DurableWorkerDbAdapter {
  constructor(private readonly connectionString: string) {}

  private async client(): Promise<PgLikeClient> {
    const moduleName = process.env.OUTBOUND_PG_MODULE ?? "";
    if (!moduleName) throw new Error("OUTBOUND_PG_MODULE is required");
    const req = createRequire(import.meta.url) as (name: string) => {
      Client: new (args: { connectionString: string }) => PgLikeClient;
    };
    const mod = req(moduleName);
    const client = new mod.Client({ connectionString: this.connectionString });
    await client.connect();
    return client;
  }

  async claimNextDueJob(workerId: string): Promise<JobRecord | null> {
    const c = await this.client();
    try {
      const result = await c.query(
        `with candidate as (
           select job_id
           from jobs
           where status = 'PENDING' and run_at <= now()
           order by run_at asc
           limit 1
           for update skip locked
         )
         update jobs j
         set status='RUNNING', locked_at=now(), locked_by=$1, attempts=j.attempts+1
         from candidate
         where j.job_id = candidate.job_id
         returning j.job_id, j.job_type, j.payload_json, j.idempotency_key, j.attempts, j.max_attempts`,
        [workerId],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        job_id: String(row.job_id),
        job_type: String(row.job_type),
        payload_json: (row.payload_json ?? {}) as Record<string, unknown>,
        idempotency_key: String(row.idempotency_key),
        attempts: Number(row.attempts ?? 0),
        max_attempts: Number(row.max_attempts ?? 0),
      };
    } finally {
      await c.end();
    }
  }

  async hasIdempotentSuccess(key: string): Promise<boolean> {
    const c = await this.client();
    try {
      const result = await c.query(
        `select 1 from idempotency where idempotency_key=$1 and status='SUCCESS' limit 1`,
        [key],
      );
      return result.rowCount > 0;
    } finally {
      await c.end();
    }
  }

  async writeIdempotencySuccess(key: string, resultRef: string): Promise<void> {
    const c = await this.client();
    try {
      await c.query(
        `insert into idempotency (idempotency_key,status,result_ref)
         values ($1,'SUCCESS',$2)
         on conflict (idempotency_key) do update
         set status='SUCCESS', result_ref=excluded.result_ref`,
        [key, resultRef],
      );
    } finally {
      await c.end();
    }
  }

  async markJobDone(jobId: string): Promise<void> {
    await this.markJob(jobId, "DONE");
  }

  async markJobFailure(jobId: string, error: string, status: "FAILED" | "DEAD"): Promise<void> {
    const c = await this.client();
    try {
      await c.query(`update jobs set status=$2, last_error=$3 where job_id=$1`, [jobId, status, error]);
    } finally {
      await c.end();
    }
  }

  async rescheduleJob(jobId: string, nextRunAtIso: string, error: string): Promise<void> {
    const c = await this.client();
    try {
      await c.query(
        `update jobs
         set status='PENDING', run_at=$2::timestamptz, last_error=$3, locked_at=null, locked_by=null
         where job_id=$1`,
        [jobId, nextRunAtIso, error],
      );
    } finally {
      await c.end();
    }
  }

  async releaseStaleLocks(nowIso: string): Promise<number> {
    const c = await this.client();
    try {
      const result = await c.query(
        `update jobs set status='PENDING', locked_at=null, locked_by=null
         where status='RUNNING' and locked_at < ($1::timestamptz - interval '2 minutes')`,
        [nowIso],
      );
      return result.rowCount;
    } finally {
      await c.end();
    }
  }

  async enqueueOverdueTouchesWithCatchup(): Promise<number> {
    // Wire to campaign_memberships catch-up mapping rules.
    return 0;
  }

  async verifySuppressionIntegrity(): Promise<void> {
    return;
  }

  async appendAudit(eventType: string, payloadJson: Record<string, unknown>): Promise<void> {
    const c = await this.client();
    try {
      await c.query(`insert into audit_log (event_type, payload) values ($1, $2::jsonb)`, [
        eventType,
        JSON.stringify(payloadJson),
      ]);
    } finally {
      await c.end();
    }
  }

  async enqueueJob(
    jobType: string,
    runAtIso: string,
    payloadJson: Record<string, unknown>,
    idempotencyKey: string,
    maxAttempts = 5,
  ): Promise<void> {
    const c = await this.client();
    try {
      await c.query(
        `insert into jobs (job_id, job_type, run_at, payload_json, status, attempts, max_attempts, idempotency_key)
         values ($1,$2,$3::timestamptz,$4::jsonb,'PENDING',0,$5,$6)
         on conflict (job_id) do nothing`,
        [randomUUID(), jobType, runAtIso, JSON.stringify(payloadJson), maxAttempts, idempotencyKey],
      );
    } finally {
      await c.end();
    }
  }

  async getMembershipById(membershipId: string): Promise<MembershipRecord | null> {
    const c = await this.client();
    try {
      const r = await c.query(
        `select membership_id, account_id, lead_phone, campaign_name, step_index, mode, touch_count, last_touch_at, next_touch_at
         from campaign_membership
         where membership_id=$1 limit 1`,
        [membershipId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return row as unknown as MembershipRecord;
    } finally {
      await c.end();
    }
  }

  async isSuppressed(accountId: string, phone: string): Promise<boolean> {
    const c = await this.client();
    try {
      const r = await c.query(`select 1 from suppression where account_id=$1 and phone=$2 limit 1`, [accountId, phone]);
      return r.rowCount > 0;
    } finally {
      await c.end();
    }
  }

  async updateMembershipAfterTouch(args: {
    membershipId: string;
    nextStepIndex: number;
    nextTouchAtIso: string | null;
    nextMode: "cadence" | "closed";
    touchedAtIso: string;
  }): Promise<void> {
    const c = await this.client();
    try {
      await c.query(
        `update campaign_membership
         set step_index=$2, next_touch_at=$3::timestamptz, mode=$4, last_touch_at=$5::timestamptz, touch_count=touch_count+1
         where membership_id=$1`,
        [args.membershipId, args.nextStepIndex, args.nextTouchAtIso, args.nextMode, args.touchedAtIso],
      );
    } finally {
      await c.end();
    }
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
    const c = await this.client();
    try {
      await c.query(
        `insert into outbound_messages
         (message_sid, account_id, membership_id, to_phone, status, body, template_id, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,now(),now())
         on conflict (message_sid)
         do update set status=excluded.status, updated_at=now()`,
        [args.messageSid, args.accountId, args.membershipId, args.toPhone, args.status, args.body, args.templateId],
      );
    } finally {
      await c.end();
    }
  }

  async updateOutboundMessageStatus(args: {
    messageSid: string;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<void> {
    const c = await this.client();
    try {
      await c.query(
        `update outbound_messages
         set status=$2, error_code=$3, error_message=$4, updated_at=now()
         where message_sid=$1`,
        [args.messageSid, args.status, args.errorCode ?? null, args.errorMessage ?? null],
      );
    } finally {
      await c.end();
    }
  }

  private async markJob(jobId: string, status: "DONE"): Promise<void> {
    const c = await this.client();
    try {
      await c.query(`update jobs set status=$2, locked_at=null, locked_by=null where job_id=$1`, [jobId, status]);
    } finally {
      await c.end();
    }
  }
}
