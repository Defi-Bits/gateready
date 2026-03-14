import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
const META_PATH = "/Users/terminal/.openclaw/workspace/mission-control/state/docs-meta.json";

function safeName(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_\.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-\.]+|[-\.]+$/g, "") || "untitled";
}
function readJson(path: string, fb: any) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fb; } }

export async function GET(req: NextRequest) {
  const name = String(req.nextUrl.searchParams.get("name") || "");
  if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  const key = safeName(name).endsWith(".md") ? safeName(name) : `${safeName(name)}.md`;
  const db = readJson(META_PATH, {});
  return NextResponse.json({ ok: true, name: key, meta: db[key] || { comments: [], assignments: [] } });
}

export async function POST(req: NextRequest) {
  mkdirSync(join("/Users/terminal/.openclaw/workspace/mission-control", "state"), { recursive: true });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "");
  const type = String(body?.type || "");
  if (!name || !type) return NextResponse.json({ ok: false, error: "name_and_type_required" }, { status: 400 });

  const key = safeName(name).endsWith(".md") ? safeName(name) : `${safeName(name)}.md`;
  const db = readJson(META_PATH, {});
  db[key] = db[key] || { comments: [], assignments: [] };

  if (type === "comment") {
    const text = String(body?.text || "").trim();
    const author = String(body?.author || "K");
    if (!text) return NextResponse.json({ ok: false, error: "comment_text_required" }, { status: 400 });
    db[key].comments.push({ id: `c_${Date.now()}`, ts: new Date().toISOString(), author, text });
  } else if (type === "assignment") {
    const assignee = String(body?.assignee || "").trim();
    const task = String(body?.task || "").trim();
    if (!assignee || !task) return NextResponse.json({ ok: false, error: "assignee_and_task_required" }, { status: 400 });
    db[key].assignments.push({ id: `a_${Date.now()}`, ts: new Date().toISOString(), assignee, task, status: "open" });
  } else if (type === "assignment_status") {
    const assignmentId = String(body?.assignmentId || "").trim();
    const status = String(body?.status || "").trim();
    if (!assignmentId || !status) return NextResponse.json({ ok: false, error: "assignment_id_and_status_required" }, { status: 400 });
    const row = (db[key].assignments || []).find((a: any) => String(a?.id || "") === assignmentId);
    if (!row) return NextResponse.json({ ok: false, error: "assignment_not_found" }, { status: 404 });
    row.status = status;
    row.updatedAt = new Date().toISOString();
  } else {
    return NextResponse.json({ ok: false, error: "unknown_type" }, { status: 400 });
  }

  writeFileSync(META_PATH, JSON.stringify(db, null, 2));
  return NextResponse.json({ ok: true, name: key, meta: db[key] });
}
