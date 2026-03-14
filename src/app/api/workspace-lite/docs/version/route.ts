import { NextRequest, NextResponse } from "next/server";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

const DOCS_DIR = "/Users/terminal/.openclaw/workspace/mission-control/docs/workspace-lite";
const VERSIONS_DIR = "/Users/terminal/.openclaw/workspace/mission-control/state/docs-versions";
const AUDIT_PATH = "/Users/terminal/.openclaw/workspace/mission-control/state/docs-audit.jsonl";

function safeName(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_\.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-\.]+|[-\.]+$/g, "") || "untitled";
}

export async function GET(req: NextRequest) {
  mkdirSync(VERSIONS_DIR, { recursive: true });
  const name = String(req.nextUrl.searchParams.get("name") || "");
  if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

  const key = safeName(name).endsWith(".md") ? safeName(name) : `${safeName(name)}.md`;
  const dir = join(VERSIONS_DIR, key.replace(/\.md$/, ""));
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort((a, b) => b.localeCompare(a));
    return NextResponse.json({ ok: true, name: key, versions: files.slice(0, 30) });
  } catch {
    return NextResponse.json({ ok: true, name: key, versions: [] });
  }
}

export async function POST(req: NextRequest) {
  mkdirSync(VERSIONS_DIR, { recursive: true });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "snapshot");
  const name = String(body?.name || "");
  if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });

  const key = safeName(name).endsWith(".md") ? safeName(name) : `${safeName(name)}.md`;
  const docPath = join(DOCS_DIR, key);
  const dir = join(VERSIONS_DIR, key.replace(/\.md$/, ""));
  mkdirSync(dir, { recursive: true });

  if (action === "snapshot") {
    let content = "";
    try { content = readFileSync(docPath, "utf8"); } catch {}
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const out = join(dir, `${stamp}.md`);
    writeFileSync(out, content);
    return NextResponse.json({ ok: true, action, name: key, version: out.split("/").pop() });
  }

  if (action === "restore") {
    const version = String(body?.version || "");
    const actor = String(body?.actor || "workspace-lite");
    if (!version) return NextResponse.json({ ok: false, error: "version_required" }, { status: 400 });
    const vPath = join(dir, version);
    let content = "";
    try { content = readFileSync(vPath, "utf8"); } catch { return NextResponse.json({ ok: false, error: "version_not_found" }, { status: 404 }); }

    let preRestoreVersion: string | null = null;
    try {
      const current = readFileSync(docPath, "utf8");
      preRestoreVersion = `${new Date().toISOString().replace(/[:.]/g, "-")}--pre-restore.md`;
      writeFileSync(join(dir, preRestoreVersion), current);
    } catch {}

    writeFileSync(docPath, content);
    const ts = new Date().toISOString();
    appendFileSync(AUDIT_PATH, `${JSON.stringify({ ts, event: "doc_restore", actor, name: key, restoredVersion: version, preRestoreVersion })}\n`);

    return NextResponse.json({ ok: true, action, name: key, restored: version, preRestoreVersion, auditTs: ts });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
