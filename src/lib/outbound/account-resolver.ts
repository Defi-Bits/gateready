import { AccountId } from "./types";

const DEFAULT_ACCOUNT: AccountId = "WHOLESALE";

// Env format:
// OUTBOUND_ACCOUNT_BY_TO=+18885550111:WHOLESALE,+18885550112:AGENCY
export function resolveAccountByToPhone(toPhone?: string | null): AccountId {
  if (!toPhone) return DEFAULT_ACCOUNT;
  const mapping = process.env.OUTBOUND_ACCOUNT_BY_TO ?? "";
  if (!mapping) return DEFAULT_ACCOUNT;

  const normalized = normalizePhone(toPhone);
  const pairs = mapping.split(",").map((p) => p.trim()).filter(Boolean);

  for (const pair of pairs) {
    const [phone, account] = pair.split(":").map((x) => x.trim());
    if (!phone || !account) continue;
    if (normalizePhone(phone) === normalized && isAccountId(account)) {
      return account;
    }
  }
  return DEFAULT_ACCOUNT;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function isAccountId(value: string): value is AccountId {
  return value === "WHOLESALE" || value === "AGENCY" || value === "SUMMIT" || value === "EDGE";
}
