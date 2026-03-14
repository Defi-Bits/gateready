export type AccountId = "WHOLESALE" | "AGENCY" | "SUMMIT" | "EDGE";

export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "DEAD";

export interface InboundSmsPayload {
  accountId: AccountId;
  fromPhone: string;
  toPhone: string;
  body: string;
  messageSid?: string;
  raw?: Record<string, string>;
}

export interface SmsStatusPayload {
  accountId: AccountId;
  messageSid: string;
  messageStatus: string;
  toPhone?: string;
  fromPhone?: string;
  errorCode?: string;
  errorMessage?: string;
  raw?: Record<string, string>;
}

export interface EngineJob {
  jobId: string;
  jobType: string;
  runAt: string;
  payloadJson: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
}

export interface MembershipContext {
  membershipId: string;
  campaignName: string;
  stepIndex: number;
  mode: "cadence" | "conversation" | "escalated" | "suppressed" | "closed";
}

export interface OutboundStore {
  appendAudit(eventType: string, payload: Record<string, unknown>): Promise<void>;
  suppressPhone(accountId: AccountId, phone: string, reason: "stop" | "wrong_number"): Promise<void>;
  pauseMembershipByPhone(accountId: AccountId, phone: string, reason: string): Promise<void>;
  enqueueJob(job: EngineJob): Promise<void>;
  getMembershipByPhone(accountId: AccountId, phone: string): Promise<MembershipContext | null>;
  updateOutboundMessageStatus(args: {
    messageSid: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void>;
}
