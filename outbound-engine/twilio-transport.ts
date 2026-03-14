export interface TwilioSendArgs {
  accountId: string;
  toPhone: string;
  body: string;
  statusCallbackUrl?: string;
}

export interface TwilioSendResult {
  ok: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
}

export async function sendSmsViaTwilio(args: TwilioSendArgs): Promise<TwilioSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return { ok: false, error: "missing_twilio_credentials" };
  }

  const messagingServiceSid = resolveMessagingServiceSid(args.accountId);
  const fromPhone = resolveFromPhone(args.accountId);
  if (!messagingServiceSid && !fromPhone) {
    return { ok: false, error: "missing_twilio_sender_for_account" };
  }

  const body = new URLSearchParams();
  body.set("To", args.toPhone);
  body.set("Body", args.body);
  if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
  if (!messagingServiceSid && fromPhone) body.set("From", fromPhone);
  if (args.statusCallbackUrl) body.set("StatusCallback", args.statusCallbackUrl);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, error: String(json.message ?? `twilio_http_${res.status}`) };
  }

  return {
    ok: true,
    messageSid: String(json.sid ?? ""),
    status: String(json.status ?? "queued"),
  };
}

function resolveMessagingServiceSid(accountId: string): string | null {
  const mapping = process.env.OUTBOUND_TWILIO_MESSAGING_SERVICE_BY_ACCOUNT ?? "";
  if (!mapping) return null;
  return resolveByMap(mapping, accountId);
}

function resolveFromPhone(accountId: string): string | null {
  const mapping = process.env.OUTBOUND_TWILIO_FROM_BY_ACCOUNT ?? "";
  if (!mapping) return null;
  return resolveByMap(mapping, accountId);
}

function resolveByMap(text: string, accountId: string): string | null {
  const pairs = text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  for (const pair of pairs) {
    const [k, v] = pair.split(":").map((x) => x.trim());
    if (k === accountId && v) return v;
  }
  return null;
}
