import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";

function readJsonl(path: string) { try { return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }

export async function GET(req: NextRequest) {
  const venture = String(req.nextUrl.searchParams.get("venture") || "").toLowerCase();
  if (!venture) return NextResponse.json({ ok: false, error: "venture_required" }, { status: 400 });

  const decisions = readJsonl(join(ROOT, "state", "content-review-decisions.jsonl"))
    .filter((d: any) => String(d?.venture || "").toLowerCase() === venture)
    .slice(-10).reverse();

  const queue = readJsonl(join(ROOT, "state", "automation-priority-queue.jsonl"))
    .filter((q: any) => String(q?.venture || "").toLowerCase() === venture || String(q?.venture || "").toLowerCase() === "portfolio")
    .slice(-10).reverse();

  const media = readJsonl(join(ROOT, "state", `${venture}-media-index.jsonl`));
  const mediaFallback = venture === "summit" ? readJsonl(join(ROOT, "state", "summit-media-index.jsonl")) : [];
  const items = (media.length ? media : mediaFallback).slice(-10).reverse();

  return NextResponse.json({ ok: true, venture, linked: { decisions, queue, media: items } });
}
