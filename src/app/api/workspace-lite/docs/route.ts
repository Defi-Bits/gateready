import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";

const DOCS_DIR = "/Users/terminal/.openclaw/workspace/mission-control/docs/workspace-lite";

function ensureDir() {
  mkdirSync(DOCS_DIR, { recursive: true });
}

function safeName(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_\.]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-\.]+|[-\.]+$/g, "") || "untitled";
}

export async function GET(req: NextRequest) {
  ensureDir();
  const name = req.nextUrl.searchParams.get("name");
  const venture = String(req.nextUrl.searchParams.get("venture") || "all").toLowerCase();

  if (name) {
    const file = safeName(name).endsWith(".md") ? safeName(name) : `${safeName(name)}.md`;
    const fullPath = join(DOCS_DIR, file);
    try {
      const content = readFileSync(fullPath, "utf8");
      return NextResponse.json({ ok: true, name: file, content });
    } catch {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
  }

  const files = readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => {
      if (venture === "all") return true;
      return f.startsWith(`${venture}__`) || f.startsWith("global__");
    })
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, path: `mission-control/docs/workspace-lite/${name}` }));

  return NextResponse.json({ ok: true, files, venture });
}

export async function POST(req: NextRequest) {
  ensureDir();
  const body = await req.json().catch(() => ({}));
  const rawName = String(body?.name || "");
  const content = String(body?.content || "");
  const venture = String(body?.venture || "all").toLowerCase();

  if (!rawName.trim()) {
    return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
  }

  const base = safeName(rawName).endsWith(".md") ? safeName(rawName).slice(0, -3) : safeName(rawName);
  const prefix = venture === "all" ? "global" : safeName(venture);
  const file = `${prefix}__${base}.md`;
  const fullPath = join(DOCS_DIR, file);

  const stamped = `---\nventure: ${prefix}\nupdatedAt: ${new Date().toISOString()}\n---\n\n${content}`;
  writeFileSync(fullPath, stamped);

  return NextResponse.json({ ok: true, name: file, path: `mission-control/docs/workspace-lite/${file}`, venture: prefix });
}
