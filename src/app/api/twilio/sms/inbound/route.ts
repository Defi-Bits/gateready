import { NextRequest, NextResponse } from "next/server";
import { resolveAccountByToPhone } from "@/lib/outbound/account-resolver";
import { handleInboundSms } from "@/lib/outbound/engine";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData();
  const body = toRecord(form);

  const accountId = resolveAccountByToPhone(body.To);
  const result = await handleInboundSms({
    accountId,
    fromPhone: body.From ?? "",
    toPhone: body.To ?? "",
    body: body.Body ?? "",
    messageSid: body.MessageSid,
    raw: body,
  });

  if (result.twiml) {
    return new NextResponse(result.twiml, {
      status: 200,
      headers: { "content-type": "text/xml" },
    });
  }

  return NextResponse.json({ ok: true, action: result.action });
}

function toRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    out[key] = String(value);
  }
  return out;
}
