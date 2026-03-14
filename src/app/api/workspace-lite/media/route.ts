import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";

function readJsonl(path: string) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const venture = String(req.nextUrl.searchParams.get("venture") || "summit").toLowerCase();
  const q = String(req.nextUrl.searchParams.get("q") || "").toLowerCase();
  const stage = String(req.nextUrl.searchParams.get("stage") || "all").toLowerCase();
  const status = String(req.nextUrl.searchParams.get("status") || "all").toLowerCase();
  const limit = Number(req.nextUrl.searchParams.get("limit") || "50");

  const indexPath = join(ROOT, "state", `${venture}-media-index.jsonl`);
  const fallbackPath = join(ROOT, "state", "summit-media-index.jsonl");
  let rows = readJsonl(indexPath);
  if (!rows.length && venture === "summit") rows = readJsonl(fallbackPath);

  const filtered = rows
    .filter((r: any) => !stage || stage === "all" || String(r?.stage || "").toLowerCase() === stage)
    .filter((r: any) => !status || status === "all" || String(r?.publishState || r?.status || "").toLowerCase() === status)
    .filter((r: any) => {
      if (!q) return true;
      const hay = `${r?.jobId || ""} ${r?.serviceType || ""} ${r?.addressZone || ""} ${r?.notes || ""} ${r?.filename || ""}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(-limit)
    .reverse();

  return NextResponse.json({ ok: true, venture, total: rows.length, count: filtered.length, items: filtered });
}
