import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const now = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    service: "mission-control",
    timestamp: now,
    store: process.env.OUTBOUND_STORE ?? "noop",
    environment: process.env.NODE_ENV ?? "development",
    version: process.env.npm_package_version ?? "unknown",
  });
}
