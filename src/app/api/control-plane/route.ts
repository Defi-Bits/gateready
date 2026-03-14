import { NextResponse } from "next/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

export const runtime = "nodejs";

const ROOT = "/Users/terminal/.openclaw/workspace/mission-control";
const WORKSPACE = "/Users/terminal/.openclaw/workspace";

function readJson(path: string, fallback: any) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function readJsonl(path: string) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function readJsonlCount(path: string) {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function launchd(label: string) {
  try {
    const out = execSync(`launchctl print gui/$(id -u)/${label} | egrep "state =|runs =|last exit code"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: "/bin/zsh",
    });
    return out.trim();
  } catch {
    return "unavailable";
  }
}

function loadOrganizationContext() {
  const ventureProfiles = readJson(join(WORKSPACE, "shared-core", "strategy", "venture-profiles.json"), {});
  const identity = readFileSync(join(WORKSPACE, "IDENTITY.md"), "utf8");
  const systemsBuilt = [
    "Security Chief v2 (events, threat model, remediation tasks)",
    "Config drift hashing monitor",
    "Durable content library (SQLite)",
    "Platform-aware content rendering profiles",
    "Telegram live publish path",
    "Control-plane quick actions with audit log",
  ];

  return {
    operator: "Kwasi",
    assistantName: identity.match(/\*\*Name:\*\*\s*(.+)/)?.[1]?.trim() || "Zuri",
    ventures: Object.keys(ventureProfiles || {}),
    ventureProfiles,
    systemsBuilt,
  };
}

function loadSecurityChief() {
  const dbPath = join(ROOT, "state", "security-chief.db");
  try {
    const db = new DatabaseSync(dbPath);

    const sev = (db.prepare(`SELECT severity, COUNT(*) AS c FROM security_events WHERE datetime(ts) >= datetime('now','-7 days') GROUP BY severity`) as any).all() as any[];
    const signals = (db.prepare(`SELECT event_type, COUNT(*) AS c FROM security_events WHERE datetime(ts) >= datetime('now','-7 days') GROUP BY event_type ORDER BY c DESC LIMIT 5`) as any).all() as any[];
    const risks = (db.prepare(`SELECT scenario, residual_risk, detection_coverage, recommended_action FROM threat_hypotheses ORDER BY ts DESC LIMIT 5`) as any).all() as any[];
    const tasks = (db.prepare(`SELECT id, title, description, severity, owner, status, due_at, source_risk, last_updated FROM remediation_tasks WHERE status IN ('open','in_progress') ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END, created_at DESC LIMIT 30`) as any).all() as any[];
    const assignments = (db.prepare(`SELECT id, task_id, worker_id, worker_name, stage, status, notes, updated_at FROM remediation_assignments ORDER BY updated_at DESC LIMIT 40`) as any).all() as any[];

    const sevMap = Object.fromEntries(sev.map((s) => [s.severity, Number(s.c)]));
    const postureScore = Math.max(0, Math.min(100, 100 - (sevMap.critical || 0) * 18 - (sevMap.warn || 0) * 4 - (sevMap.info || 0)));

    const immediateActions = tasks
      .filter((t) => t.severity === "critical" || t.status === "open")
      .slice(0, 5)
      .map((t) => ({
        title: t.title,
        severity: t.severity,
        due_at: t.due_at,
        status: t.status,
      }));

    const pendingByStage = {
      chief: assignments.filter((a) => a.status === "pending" && a.stage === "chief").length,
      zuri: assignments.filter((a) => a.status === "pending" && a.stage === "zuri").length,
      user: assignments.filter((a) => a.status === "pending" && a.stage === "user").length,
    };

    const queue = {
      totalOpenTasks: tasks.filter((t) => t.status === "open").length,
      inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
      pendingAssignments: assignments.filter((a) => a.status === "pending").length,
      pendingByStage,
      updatedAt: new Date().toISOString(),
    };

    return {
      ok: true,
      dbPath,
      postureScore,
      severity: sev,
      topSignals: signals,
      topRisks: risks,
      openTasks: tasks,
      assignments,
      pendingByStage,
      remediationQueue: queue,
      immediateActions,
    };
  } catch (e) {
    return {
      ok: false,
      dbPath,
      error: String((e as Error)?.message || e),
    };
  }
}

function loadWorkspaceLite(venture: string) {
  const scoped = (venture || "all").toLowerCase();
  const ventureBoardPath = join(ROOT, "state", `content-review-board-${scoped}.md`);
  const boardPath = join(ROOT, "state", "content-review-board.md");
  const decisionsPath = join(ROOT, "state", "content-review-decisions.jsonl");
  const docsDir = join(ROOT, "docs");
  const workspaceDocsDir = join(ROOT, "docs", "workspace-lite");
  const summitMediaIndexPath = join(ROOT, "state", "summit-media-index.jsonl");
  const summitMediaQueuePath = join(ROOT, "state", "summit-media-review.jsonl");
  const summitMediaSiteFeedPath = join(ROOT, "state", "summit-media-site-feed.json");
  const contentDecisionAuditPath = join(ROOT, "state", "content-decision-audit.jsonl");
  const mediaIntentPath = join(WORKSPACE, "shared-core", "policies", "media-intent-by-venture.json");

  let board = "";
  try { board = readFileSync(ventureBoardPath, "utf8"); } catch {
    try { board = readFileSync(boardPath, "utf8"); } catch {}
  }

  const decisions = readJsonl(decisionsPath)
    .filter((d: any) => !venture || String(d?.venture || "").toLowerCase() === venture.toLowerCase())
    .slice(-20)
    .reverse();

  let docs: Array<{ name: string; path: string }> = [];
  try {
    const rootDocs = readdirSync(docsDir)
      .filter((f) => f.endsWith(".md"))
      .map((name) => ({ name, path: `mission-control/docs/${name}` }));

    const wsDocs = readdirSync(workspaceDocsDir)
      .filter((f) => f.endsWith(".md"))
      .map((name) => ({ name, path: `mission-control/docs/workspace-lite/${name}` }));

    docs = [...rootDocs, ...wsDocs].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    try {
      docs = readdirSync(docsDir)
        .filter((f) => f.endsWith(".md"))
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name, path: `mission-control/docs/${name}` }));
    } catch {}
  }

  const summitMediaIndex = readJsonl(summitMediaIndexPath);
  const summitMediaQueue = readJsonl(summitMediaQueuePath);
  const summitMediaFeed = readJson(summitMediaSiteFeedPath, null);
  const decisionAudit = readJsonl(contentDecisionAuditPath);
  const mediaIntentAll = readJson(mediaIntentPath, {});
  const mediaIntent = mediaIntentAll?.[scoped] || null;

  const scoredRecent = summitMediaIndex.slice(-30).reverse().map((m: any) => {
    let score = 40;
    if (m?.jobId) score += 10;
    if (m?.serviceType) score += 10;
    if (m?.addressZone) score += 8;
    if (m?.stage) score += 8;
    if (m?.privacyChecked) score += 10;
    if (m?.websiteReady) score += 10;
    if (m?.publishState === "approved") score += 10;
    return { ...m, readinessScore: Math.min(100, score) };
  });

  const decisionAuditByRender: Record<string, any> = {};
  for (const a of decisionAudit) {
    const rid = String(a?.renderId || "");
    if (!rid) continue;
    decisionAuditByRender[rid] = a;
  }

  return {
    board,
    decisions,
    docs,
    boardPath: board ? (venture ? ventureBoardPath : boardPath) : boardPath,
    decisionsPath,
    decisionAuditByRender,
    summitMedia: {
      total: summitMediaIndex.length,
      pendingReview: summitMediaQueue.filter((q: any) => q.status === "pending").length,
      recent: scoredRecent.slice(0, 12),
      siteFeed: summitMediaFeed,
    },
    mediaIntent,
  };
}

function loadIntegrations(venture: string) {
  const approvals = readJsonl(join(ROOT, "state", "outreach-approvals.jsonl"));
  const drafts = readJsonl(join(ROOT, "state", "outreach-drafts.jsonl"));
  const published = readJsonl(join(ROOT, "state", "outreach-published.jsonl"));
  const contentDbPath = join(ROOT, "state", "content-library.db");

  const approvalsScoped = approvals.filter((a: any) => !venture || String(a?.venture || "").toLowerCase() === venture.toLowerCase());
  const draftsScoped = drafts.filter((d: any) => !venture || String(d?.venture || "").toLowerCase() === venture.toLowerCase());
  const publishedScoped = published.filter((p: any) => !venture || String(p?.venture || "").toLowerCase() === venture.toLowerCase());

  const readyToPublish = approvalsScoped.filter((a: any) => a.status === "ready_to_publish").length;
  const telegramLive = publishedScoped.filter((p: any) => p.channel === "telegram" && p.mode === "live" && p.status === "published_live").length;
  const twitterLive = publishedScoped.filter((p: any) => p.channel === "twitter" && p.mode === "live" && p.status === "published_live").length;

  let contentStats: any = { ok: false };
  try {
    const db = new DatabaseSync(contentDbPath);
    const byPlatform = (db.prepare(`SELECT platform, status, COUNT(*) c FROM content_renders GROUP BY platform, status`) as any).all() as any[];
    const approved = db.prepare(`SELECT COUNT(*) c FROM content_renders WHERE status='approved'`).get() as any;
    const publishedCount = db.prepare(`SELECT COUNT(*) c FROM content_renders WHERE status='published'`).get() as any;
    contentStats = {
      ok: true,
      byPlatform,
      approved: Number(approved?.c || 0),
      published: Number(publishedCount?.c || 0),
    };
  } catch {
    contentStats = { ok: false, error: "content-library.db unavailable" };
  }

  const socialDrafts = [
    ...draftsScoped.map((d: any) => ({ ts: d.ts, venture: d.venture, platform: d.channel, status: d.status, text: d.draft, source: "outreach-drafts" })),
    ...approvalsScoped.map((a: any) => ({ ts: a.ts, venture: a.venture, platform: a.channel, status: a.status, text: a.draft, source: "outreach-approvals" })),
  ]
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
    .slice(0, 12);

  return {
    telegram: { configured: true, livePublished: telegramLive },
    twitter: { configured: true, livePublished: twitterLive },
    outreach: {
      readyToPublish,
      approvals: approvalsScoped.length,
      published: publishedScoped.length,
    },
    contentLibrary: contentStats,
    socialDrafts,
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  const runtimeControl = readJson(join(WORKSPACE, "shared-core", "policies", "runtime-control.json"), {});
  const url = new URL(req.url);
  const venture = (url.searchParams.get("venture") || "").trim();

  const queue = {
    events: readJsonlCount(join(ROOT, "state", "outreach-events.jsonl")),
    plans: readJsonlCount(join(ROOT, "state", "outreach-plan.jsonl")),
    drafts: readJsonlCount(join(ROOT, "state", "outreach-drafts.jsonl")),
    approvals: readJsonlCount(join(ROOT, "state", "outreach-approvals.jsonl")),
    published: readJsonlCount(join(ROOT, "state", "outreach-published.jsonl")),
    qc: readJsonlCount(join(ROOT, "state", "outreach-qc.jsonl")),
    content: readJsonlCount(join(ROOT, "state", "content-queue.jsonl")),
  };

  const kpi = readJson(join(ROOT, "state", "control-plane-kpi.json"), null);
  const recentActions = readJsonl(join(ROOT, "state", "control-plane-actions.jsonl")).slice(-20).reverse();

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    context: { venture: venture || "all" },
    runtimeControl,
    queue,
    kpi,
    organization: loadOrganizationContext(),
    securityChief: loadSecurityChief(),
    integrations: loadIntegrations(venture),
    workspaceLite: loadWorkspaceLite(venture),
    recentActions,
    services: {
      twitterOrchestrator: launchd("com.missioncontrol.twitter-orchestrator"),
      contentOrchestrator: launchd("com.missioncontrol.content-orchestrator"),
      engagement: launchd("com.missioncontrol.engagement"),
      queueMonitor: launchd("com.missioncontrol.queue-monitor"),
      securityChiefDaily: launchd("com.missioncontrol.security-chief-daily"),
      securityChiefWeekly: launchd("com.missioncontrol.security-chief-weekly"),
    },
  });
}
