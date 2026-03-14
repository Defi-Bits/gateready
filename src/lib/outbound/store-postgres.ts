import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { AccountId, EngineJob, MembershipContext, OutboundStore } from "./types";

type PgClient = {
  connect: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

async function getClient(connectionString: string): Promise<PgClient> {
  const moduleName = process.env.OUTBOUND_PG_MODULE ?? "";
  if (!moduleName) throw new Error("OUTBOUND_PG_MODULE is required when OUTBOUND_STORE=postgres");
  const req = createRequire(import.meta.url) as (name: string) => {
    Client: new (args: { connectionString: string }) => PgClient;
  };
  const mod = req(moduleName);
  const client = new mod.Client({ connectionString });
  await client.connect();
  return client as PgClient;
}

export class PostgresOutboundStore implements OutboundStore {
  constructor(private readonly connectionString: string) {}

  async appendAudit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const c = await getClient(this.connectionString);
    try {
      await c.query(
        `insert into audit_log (account_id, event_type, payload) values ($1,$2,$3::jsonb)`,
        [String(payload.accountId ?? ""), eventType, JSON.stringify(payload)],
      );
    } finally {
      await c.end();
    }
  }

  async suppressPhone(accountId: AccountId, phone: string, reason: "stop" | "wrong_number"): Promise<void> {
    const c = await getClient(this.connectionString);
    try {
      await c.query(
        `insert into suppressions (phone, account_id, reason)
         values ($1,$2,$3)
         on conflict (phone, account_id)
         do update set reason=excluded.reason, suppressed_at=now()`,
        [phone, accountId, reason],
      );
    } finally {
      await c.end();
    }
  }

  async pauseMembershipByPhone(accountId: AccountId, phone: string, reason: string): Promise<void> {
    const c = await getClient(this.connectionString);
    try {
      await c.query(
        `update campaign_memberships cm
         set mode='suppressed'
         from leads l
         where cm.lead_id=l.lead_id and l.account_id=$1 and l.phone=$2 and cm.mode <> 'closed'`,
        [accountId, phone],
      );
      await this.appendAudit("AutomationPaused", { accountId, phone, reason });
    } finally {
      await c.end();
    }
  }

  async enqueueJob(job: EngineJob): Promise<void> {
    const c = await getClient(this.connectionString);
    try {
      await c.query(
        `insert into jobs (job_id, job_type, run_at, payload_json, status, attempts, max_attempts, idempotency_key)
         values ($1,$2,$3::timestamptz,$4::jsonb,$5,$6,$7,$8)
         on conflict (job_id) do nothing`,
        [
          job.jobId || randomUUID(),
          job.jobType,
          job.runAt,
          JSON.stringify(job.payloadJson),
          job.status,
          job.attempts,
          job.maxAttempts,
          job.idempotencyKey,
        ],
      );
    } finally {
      await c.end();
    }
  }

  async getMembershipByPhone(accountId: AccountId, phone: string): Promise<MembershipContext | null> {
    const c = await getClient(this.connectionString);
    try {
      const r = await c.query(
        `select cm.membership_id, cm.step_index, cm.mode, c.name as campaign_name
         from leads l
         join campaign_memberships cm on cm.lead_id=l.lead_id
         join campaigns c on c.campaign_id=cm.campaign_id
         where l.account_id=$1 and l.phone=$2
         order by cm.created_at desc
         limit 1`,
        [accountId, phone],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        membershipId: String(row.membership_id),
        campaignName: String(row.campaign_name),
        stepIndex: Number(row.step_index ?? 0),
        mode: String(row.mode) as MembershipContext["mode"],
      };
    } finally {
      await c.end();
    }
  }

  async updateOutboundMessageStatus(args: {
    messageSid: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    const c = await getClient(this.connectionString);
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
}
