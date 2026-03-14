export type AccountId = "WHOLESALE" | "AGENCY" | "SUMMIT" | "EDGE";

export type EventType =
  | "LeadImported"
  | "CampaignCreated"
  | "MembershipEnrolled"
  | "TouchDue"
  | "OutboundSendRequested"
  | "OutboundSent"
  | "OutboundFailed"
  | "InboundReceived"
  | "IntentScored"
  | "MembershipAdvanced"
  | "AutomationPaused"
  | "EscalationRequested"
  | "OwnerNotified"
  | "Suppressed"
  | "ComplianceFlagged"
  | "MetricsComputed"
  | "CampaignAutopaused";

export type CommandType =
  | "SendSMS"
  | "LogMessage"
  | "Suppress"
  | "PauseMembership"
  | "NotifyOwner"
  | "AdvanceCadence";

export type MembershipMode =
  | "cadence"
  | "conversation"
  | "escalated"
  | "suppressed"
  | "closed";

export type IntentLabel = "HOT" | "WARM" | "COLD" | "ANGRY_LEGAL" | "UNKNOWN";

export interface EngineEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: EventType;
  accountId: AccountId;
  occurredAt: string;
  payload: T;
}

export interface DurableJob<T = Record<string, unknown>> {
  jobId: string;
  jobType: EventType;
  runAt: string;
  payload: T;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "DEAD";
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
}

export interface EscalationBrief {
  leadPhone: string;
  leadName?: string;
  propertyAddress?: string;
  lastInbound: string;
  campaignName: string;
  campaignStep: number;
  intentLabel: IntentLabel;
  confidence: number;
  suggestedNextMessage: string;
  suggestedCallOpener: string;
  constraints: Record<string, string | number | boolean>;
}
