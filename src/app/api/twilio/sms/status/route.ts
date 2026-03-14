import { NextRequest, NextResponse } from "next/server";
import { resolveAccountByToPhone } from "@/lib/outbound/account-resolver";
import { handleSmsStatus } from "@/lib/outbound/engine";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData();
  const body = toRecord(form);

  const accountId = resolveAccountByToPhone(body.To);
  await handleSmsStatus({
    accountId,
    messageSid: body.MessageSid ?? "",
    messageStatus: body.MessageStatus ?? "unknown",
    toPhone: body.To,
    fromPhone: body.From,
    errorCode: body.ErrorCode,
    errorMessage: body.ErrorMessage,
    raw: body,
  });

  return NextResponse.json({ ok: true });
}

function toRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    out[key] = String(value);
  }
  return out;
}
