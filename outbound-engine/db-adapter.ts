export interface JobRecord {
  job_id: string;
  job_type: string;
  payload_json: Record<string, unknown>;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
}

export interface MembershipRecord {
  membership_id: string;
  account_id: string;
  lead_phone: string;
  campaign_name: string;
  step_index: number;
  mode: string;
  touch_count: number;
  last_touch_at?: string | null;
  next_touch_at?: string | null;
}

export interface DurableWorkerDbAdapter {
  claimNextDueJob(workerId: string): Promise<JobRecord | null>;
  hasIdempotentSuccess(key: string): Promise<boolean>;
  writeIdempotencySuccess(key: string, resultRef: string): Promise<void>;
  markJobDone(jobId: string): Promise<void>;
  markJobFailure(jobId: string, error: string, status: "FAILED" | "DEAD"): Promise<void>;
  rescheduleJob(jobId: string, nextRunAtIso: string, error: string): Promise<void>;
  releaseStaleLocks(nowIso: string): Promise<number>;
  enqueueOverdueTouchesWithCatchup(nowIso: string): Promise<number>;
  verifySuppressionIntegrity(): Promise<void>;

  appendAudit(eventType: string, payloadJson: Record<string, unknown>): Promise<void>;
  enqueueJob(
    jobType: string,
    runAtIso: string,
    payloadJson: Record<string, unknown>,
    idempotencyKey: string,
    maxAttempts?: number,
  ): Promise<void>;
  getMembershipById(membershipId: string): Promise<MembershipRecord | null>;
  isSuppressed(accountId: string, phone: string): Promise<boolean>;
  updateMembershipAfterTouch(args: {
    membershipId: string;
    nextStepIndex: number;
    nextTouchAtIso: string | null;
    nextMode: "cadence" | "closed";
    touchedAtIso: string;
  }): Promise<void>;

  recordOutboundMessage(args: {
    messageSid: string;
    accountId: string;
    membershipId: string;
    toPhone: string;
    status: string;
    body: string;
    templateId: string;
  }): Promise<void>;
  updateOutboundMessageStatus(args: {
    messageSid: string;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<void>;
}
