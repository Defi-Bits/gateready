import { NextResponse } from "next/server";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

export const runtime = "nodejs";
const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const ACTION_LOG = join(ROOT, "state", "control-plane-actions.jsonl");
const CONTENT_DECISION_AUDIT = join(ROOT, "state", "content-decision-audit.jsonl");

function run(cmd: string) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: "/bin/zsh",
    timeout: 180000,
  }).trim();
}

function logAction(action: string, ok: boolean, payload: any) {
  mkdirSync(dirname(ACTION_LOG), { recursive: true });
  appendFileSync(
    ACTION_LOG,
    JSON.stringify({ ts: new Date().toISOString(), action, ok, payload }) + "\n",
  );
}

function readJsonl(path: string) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function logDecisionAudit(event: any) {
  mkdirSync(dirname(CONTENT_DECISION_AUDIT), { recursive: true });
  appendFileSync(CONTENT_DECISION_AUDIT, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const venture = String(body?.venture || "all").trim();

    const ventureRequiredActions = new Set([
      "approve_publish_next_telegram",
      "run_content_review",
      "trend_intel_generate",
      "buffer_sync_queue",
      "buffer_publish_queue",
      "run_full_chain",
      "content_decision_update",
      "content_decision_bulk_update",
      "content_decision_undo",
      "bot_nl_run",
      "summit_media_ingest",
      "summit_media_queue",
      "summit_media_export_site",
      "summit_media_mark",
    ]);

    if (ventureRequiredActions.has(action) && (!venture || venture === "all")) {
      const bad = { ok: false, error: "venture_context_required", action, hint: "Select a specific venture before running this action." };
      logAction(action, false, { ...bad, venture });
      return NextResponse.json(bad, { status: 400 });
    }

    if ((action === "summit_media_ingest" || action === "summit_media_queue" || action === "summit_media_export_site" || action === "summit_media_mark") && venture !== "summit") {
      const bad = { ok: false, error: "summit_context_required", action, hint: "Switch context to summit for media intake commands." };
      logAction(action, false, { ...bad, venture });
      return NextResponse.json(bad, { status: 400 });
    }

    if (action === "run_fire_drill") {
      const out = run("npm run -s chief:drill");
      const res = { ok: true, action, output: out };
      logAction(action, true, { output: out.slice(0, 400) });
      return NextResponse.json(res);
    }

    if (action === "run_drift_check") {
      const out = run("npm run -s chief:drift");
      const res = { ok: true, action, output: out };
      logAction(action, true, { output: out });
      return NextResponse.json(res);
    }

    if (action === "approve_publish_next_telegram") {
      const approve = run(`npm run -s content:approve -- --platform telegram --venture ${venture} --limit 1`);
      const publish = run(`npm run -s content:publish:telegram -- --mode live --venture ${venture} --limit 1`);
      const res = { ok: true, action, venture, approve, publish };
      logAction(action, true, { venture, approve: approve.slice(0, 260), publish: publish.slice(0, 260) });
      return NextResponse.json(res);
    }

    if (action === "security_assign_tasks") {
      const out = run("npm run -s chief:worker:assign");
      const res = { ok: true, action, output: out };
      logAction(action, true, { output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "run_content_review") {
      const out = run(`npm run -s content:review -- --platform x --venture ${venture} --limit 20`);
      const res = { ok: true, action, venture, output: out };
      logAction(action, true, { venture, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "trend_intel_generate") {
      const out = run(`npm run -s trend:intel -- --venture ${venture}`);
      const res = { ok: true, action, venture, output: out };
      logAction(action, true, { venture, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "buffer_sync_queue") {
      const platform = String(body?.platform || "x").trim();
      const limit = Number(body?.limit || 25);
      const out = run(`npm run -s buffer:sync -- --venture ${venture} --platform ${platform} --limit ${limit}`);
      const res = { ok: true, action, venture, platform, limit, output: out };
      logAction(action, true, { venture, platform, limit, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "buffer_publish_queue") {
      const mode = String(body?.mode || "dryrun").trim();
      const max = Number(body?.max || 10);
      const out = run(`npm run -s buffer:publish -- --mode ${mode} --max ${max}`);
      const res = { ok: true, action, venture, mode, max, output: out };
      logAction(action, true, { venture, mode, max, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "run_full_chain") {
      const platform = String(body?.platform || "x").trim();
      const mode = String(body?.mode || "dryrun").trim();
      const max = Number(body?.max || 10);
      const steps: Array<{ step: string; ok: boolean; output?: string; error?: string }> = [];
      try { steps.push({ step: "trend_intel_generate", ok: true, output: run(`npm run -s trend:intel -- --venture ${venture}`) }); } catch (e) { steps.push({ step: "trend_intel_generate", ok: false, error: String((e as Error)?.message || e) }); }
      try { steps.push({ step: "run_content_review", ok: true, output: run(`npm run -s content:review -- --platform ${platform} --venture ${venture} --limit 20`) }); } catch (e) { steps.push({ step: "run_content_review", ok: false, error: String((e as Error)?.message || e) }); }
      try { steps.push({ step: "buffer_sync_queue", ok: true, output: run(`npm run -s buffer:sync -- --venture ${venture} --platform ${platform} --limit 25`) }); } catch (e) { steps.push({ step: "buffer_sync_queue", ok: false, error: String((e as Error)?.message || e) }); }
      try { steps.push({ step: "buffer_publish_queue", ok: true, output: run(`npm run -s buffer:publish -- --mode ${mode} --max ${max}`) }); } catch (e) { steps.push({ step: "buffer_publish_queue", ok: false, error: String((e as Error)?.message || e) }); }

      const ok = steps.every((s) => s.ok);
      const res = { ok, action, venture, platform, mode, max, steps };
      logAction(action, ok, { venture, platform, mode, max, steps: steps.map((s) => ({ step: s.step, ok: s.ok })) });
      return NextResponse.json(res, { status: ok ? 200 : 207 });
    }

    if (action === "content_decision_update") {
      const renderId = String(body?.renderId || "").trim();
      const status = String(body?.status || "").trim();
      const allowed = new Set(["approved", "rewrite_needed", "rejected"]);
      if (!renderId || !allowed.has(status)) {
        const bad = { ok: false, error: "renderId_and_valid_status_required" };
        logAction(action, false, { ...bad, venture, renderId, status });
        return NextResponse.json(bad, { status: 400 });
      }

      const db = new DatabaseSync(join(ROOT, "state", "content-library.db"));
      const prev = db.prepare("SELECT status FROM content_renders WHERE id=? LIMIT 1").get(renderId) as any;
      if (!prev) {
        const bad = { ok: false, error: "render_not_found", renderId };
        logAction(action, false, { ...bad, venture });
        return NextResponse.json(bad, { status: 404 });
      }
      db.prepare("UPDATE content_renders SET status=? WHERE id=?").run(status, renderId);
      logDecisionAudit({ action: "content_decision_update", venture, renderId, fromStatus: prev.status, toStatus: status });

      const res = { ok: true, action, venture, renderId, previousStatus: prev.status, status };
      logAction(action, true, res);
      return NextResponse.json(res);
    }

    if (action === "content_decision_bulk_update") {
      const status = String(body?.status || "").trim();
      const renderIds = Array.isArray(body?.renderIds) ? body.renderIds.map((x: any) => String(x)).filter(Boolean) : [];
      const allowed = new Set(["approved", "rewrite_needed", "rejected"]);
      if (!renderIds.length || !allowed.has(status)) {
        const bad = { ok: false, error: "renderIds_and_valid_status_required" };
        logAction(action, false, { ...bad, venture, count: renderIds.length, status });
        return NextResponse.json(bad, { status: 400 });
      }

      const db = new DatabaseSync(join(ROOT, "state", "content-library.db"));
      const getStmt = db.prepare("SELECT status FROM content_renders WHERE id=? LIMIT 1");
      const updStmt = db.prepare("UPDATE content_renders SET status=? WHERE id=?");
      let changed = 0;
      for (const renderId of renderIds) {
        const prev = getStmt.get(renderId) as any;
        if (!prev) continue;
        updStmt.run(status, renderId);
        logDecisionAudit({ action: "content_decision_bulk_update", venture, renderId, fromStatus: prev.status, toStatus: status });
        changed++;
      }

      const res = { ok: true, action, venture, requested: renderIds.length, changed, status };
      logAction(action, true, res);
      return NextResponse.json(res);
    }

    if (action === "content_decision_undo") {
      const renderId = String(body?.renderId || "").trim();
      if (!renderId) {
        const bad = { ok: false, error: "renderId_required" };
        logAction(action, false, { ...bad, venture });
        return NextResponse.json(bad, { status: 400 });
      }

      const audits = readJsonl(CONTENT_DECISION_AUDIT).filter((a: any) => String(a?.renderId || "") === renderId);
      const last = audits[audits.length - 1];
      if (!last?.fromStatus) {
        const bad = { ok: false, error: "no_audit_history_for_render", renderId };
        logAction(action, false, { ...bad, venture });
        return NextResponse.json(bad, { status: 404 });
      }

      const db = new DatabaseSync(join(ROOT, "state", "content-library.db"));
      const current = db.prepare("SELECT status FROM content_renders WHERE id=? LIMIT 1").get(renderId) as any;
      if (!current) {
        const bad = { ok: false, error: "render_not_found", renderId };
        logAction(action, false, { ...bad, venture });
        return NextResponse.json(bad, { status: 404 });
      }
      db.prepare("UPDATE content_renders SET status=? WHERE id=?").run(last.fromStatus, renderId);
      logDecisionAudit({ action: "content_decision_undo", venture, renderId, fromStatus: current.status, toStatus: last.fromStatus });

      const res = { ok: true, action, venture, renderId, fromStatus: current.status, restoredStatus: last.fromStatus };
      logAction(action, true, res);
      return NextResponse.json(res);
    }

    if (action === "bot_cli_run") {
      const botAction = String(body?.botAction || "").trim();
      const botPayload = body?.botPayload && typeof body.botPayload === "object" ? body.botPayload : {};
      const allow = new Set([
        "run_content_review",
        "trend_intel_generate",
        "buffer_sync_queue",
        "buffer_publish_queue",
        "run_full_chain",
        "content_decision_update",
        "content_decision_bulk_update",
        "content_decision_undo",
        "bot_nl_run",
        "summit_media_queue",
        "summit_media_export_site",
        "summit_media_mark",
        "approve_publish_next_telegram",
      ]);
      if (!allow.has(botAction)) {
        const bad = { ok: false, error: "bot_action_not_allowlisted", botAction };
        logAction(action, false, { venture, ...bad });
        return NextResponse.json(bad, { status: 400 });
      }
      const rerouteBody = { action: botAction, venture, ...botPayload };
      const fakeReq = new Request("http://local", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rerouteBody) });
      return POST(fakeReq);
    }

    if (action === "bot_nl_run") {
      const rawText = String(body?.text || "").trim();
      const text = rawText.toLowerCase();
      if (!text) return NextResponse.json({ ok: false, error: "text_required" }, { status: 400 });

      let mappedAction = "";
      const payload: any = {};

      const platformMatch = text.match(/platform\s+([a-z0-9_-]+)/i) || text.match(/\b(x|twitter|facebook|instagram|linkedin|tiktok|telegram)\b/i);
      if (platformMatch) {
        const p = String(platformMatch[1] || "").toLowerCase();
        payload.platform = p === "twitter" ? "x" : p;
      }

      const modeMatch = text.match(/\b(dryrun|live)\b/i);
      if (modeMatch) payload.mode = String(modeMatch[1]).toLowerCase();

      const maxMatch = text.match(/\bmax\s+(\d{1,3})\b/i);
      if (maxMatch) payload.max = Number(maxMatch[1]);

      const limitMatch = text.match(/\blimit\s+(\d{1,3})\b/i);
      if (limitMatch) payload.limit = Number(limitMatch[1]);

      if (text.includes("full chain")) mappedAction = "run_full_chain";
      else if (text.includes("trend") || text.includes("intel")) mappedAction = "trend_intel_generate";
      else if (text.includes("review") && text.includes("content")) mappedAction = "run_content_review";
      else if (text.includes("sync") && text.includes("queue")) mappedAction = "buffer_sync_queue";
      else if ((text.includes("publish") || text.includes("post")) && (text.includes("dry") || payload.mode === "dryrun")) { mappedAction = "buffer_publish_queue"; payload.mode = payload.mode || "dryrun"; }
      else if ((text.includes("publish") || text.includes("post")) && (text.includes("live") || payload.mode === "live")) { mappedAction = "buffer_publish_queue"; payload.mode = payload.mode || "live"; }
      else if (text.includes("summit") && text.includes("queue")) mappedAction = "summit_media_queue";
      else if (text.includes("summit") && text.includes("export")) mappedAction = "summit_media_export_site";

      if (!mappedAction) {
        const suggestions = [
          "run full chain platform x dryrun",
          "generate trend intel",
          "run content review platform x limit 20",
          "sync queue platform instagram limit 25",
          "publish dryrun max 10",
        ];
        const res = { ok: false, error: "nl_no_mapping", hint: "Try one of the suggested commands.", suggestions };
        logAction(action, false, { venture, text: rawText, ...res });
        return NextResponse.json(res, { status: 400 });
      }

      const fakeReq = new Request("http://local", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: mappedAction, venture, ...payload }) });
      const routed = await POST(fakeReq);
      const routedJson = await routed.json();
      return NextResponse.json({ ok: !!routedJson?.ok, action, mappedAction, venture, parsed: payload, result: routedJson });
    }

    if (action === "summit_media_ingest") {
      const source = String(body?.source || "").trim();
      const jobId = String(body?.jobId || "").trim();
      const stage = String(body?.stage || "after").trim();
      const serviceType = String(body?.serviceType || "").trim();
      const zone = String(body?.zone || "").trim();
      const crew = String(body?.crew || "").trim();
      if (!source || !jobId) {
        const bad = { ok: false, error: "source_and_jobId_required", action };
        logAction(action, false, { ...bad, venture });
        return NextResponse.json(bad, { status: 400 });
      }
      const out = run(`npm run -s summit:media:ingest -- --source ${JSON.stringify(source)} --jobId ${JSON.stringify(jobId)} --stage ${JSON.stringify(stage)} --serviceType ${JSON.stringify(serviceType)} --zone ${JSON.stringify(zone)} --crew ${JSON.stringify(crew)}`);
      const res = { ok: true, action, venture, output: out };
      logAction(action, true, { venture, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "summit_media_queue") {
      const out = run("npm run -s summit:media:queue");
      const res = { ok: true, action, venture, output: out };
      logAction(action, true, { venture, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "summit_media_export_site") {
      const out = run("npm run -s summit:media:export:site");
      const res = { ok: true, action, venture, output: out };
      logAction(action, true, { venture, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (action === "summit_media_mark") {
      const mediaId = String(body?.mediaId || "").trim();
      const jobId = String(body?.jobId || "").trim();
      const websiteReady = String(body?.websiteReady ?? "").trim();
      const privacyChecked = String(body?.privacyChecked ?? "").trim();
      const flag = String(body?.flag || "").trim();
      const publishState = String(body?.publishState || "").trim();
      const note = String(body?.note || "").trim();
      const out = run(`npm run -s summit:media:mark -- ${mediaId ? `--mediaId ${JSON.stringify(mediaId)}` : ''} ${jobId ? `--jobId ${JSON.stringify(jobId)}` : ''} ${websiteReady ? `--websiteReady ${JSON.stringify(websiteReady)}` : ''} ${privacyChecked ? `--privacyChecked ${JSON.stringify(privacyChecked)}` : ''} ${flag ? `--flag ${JSON.stringify(flag)}` : ''} ${publishState ? `--publishState ${JSON.stringify(publishState)}` : ''} ${note ? `--note ${JSON.stringify(note)}` : ''}`);
      const res = { ok: true, action, venture, output: out };
      logAction(action, true, { venture, mediaId, jobId, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    if (
      action === "security_approve_next_chief" ||
      action === "security_approve_next_zuri" ||
      action === "security_approve_next_user" ||
      action === "security_reject_next_chief" ||
      action === "security_reject_next_zuri" ||
      action === "security_reject_next_user"
    ) {
      const isApprove = action.includes("approve");
      const stage = action.includes("_chief") ? "chief" : action.includes("_zuri") ? "zuri" : "user";
      const decision = isApprove ? "approve" : "reject";
      const assignmentId = run(`node -e \"const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('state/security-chief.db'); const row=db.prepare(\\\"SELECT id FROM remediation_assignments WHERE status='pending' AND stage='${stage}' ORDER BY updated_at ASC LIMIT 1\\\").get(); if(!row){process.stdout.write(''); process.exit(0);} process.stdout.write(String(row.id));\"`);
      if (!assignmentId) {
        const none = { ok: true, action, skipped: true, reason: `no_pending_${stage}` };
        logAction(action, true, none);
        return NextResponse.json(none);
      }
      const note = isApprove ? "approved from mission control" : "rejected from mission control";
      const out = run(`npm run -s chief:worker:approve -- --assignmentId ${assignmentId} --stage ${stage} --decision ${decision} --note \"${note}\"`);
      const res = { ok: true, action, assignmentId, decision, output: out };
      logAction(action, true, { assignmentId, decision, output: out.slice(0, 500) });
      return NextResponse.json(res);
    }

    const bad = { ok: false, error: "unknown_action", venture };
    logAction(action || "unknown", false, bad);
    return NextResponse.json(bad, { status: 400 });
  } catch (e) {
    const err = { ok: false, error: String((e as Error)?.message || e) };
    logAction("exception", false, err);
    return NextResponse.json(err, { status: 500 });
  }
}
