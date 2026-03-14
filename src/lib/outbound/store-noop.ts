import { EngineJob, MembershipContext, OutboundStore, AccountId } from "./types";

export class NoopOutboundStore implements OutboundStore {
  async appendAudit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    console.log("[outbound.audit]", eventType, payload);
  }

  async suppressPhone(accountId: AccountId, phone: string, reason: "stop" | "wrong_number"): Promise<void> {
    console.log("[outbound.suppress]", { accountId, phone, reason });
  }

  async pauseMembershipByPhone(accountId: AccountId, phone: string, reason: string): Promise<void> {
    console.log("[outbound.pause]", { accountId, phone, reason });
  }

  async enqueueJob(job: EngineJob): Promise<void> {
    console.log("[outbound.enqueue]", job);
  }

  async getMembershipByPhone(_accountId: AccountId, _phone: string): Promise<MembershipContext | null> {
    return null;
  }

  async updateOutboundMessageStatus(args: {
    messageSid: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    console.log("[outbound.status]", args);
  }
}
