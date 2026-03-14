"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Shield,
  Megaphone,
  Building2,
  Cpu,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Send,
  RefreshCw,
  NotebookText,
} from "lucide-react";

type TabKey = "overview" | "workspace" | "security" | "content" | "ventures" | "runtime" | "forensics";

const tabs: Array<{ id: TabKey; label: string; icon: any }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "workspace", label: "Workspace Lite", icon: NotebookText },
  { id: "security", label: "Security Chief", icon: Shield },
  { id: "content", label: "Content Ops", icon: Megaphone },
  { id: "ventures", label: "Ventures", icon: Building2 },
  { id: "runtime", label: "Runtime", icon: Cpu },
  { id: "forensics", label: "Forensics", icon: ScrollText },
];

export default function MissionControlV2() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVenture, setSelectedVenture] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [actionResult, setActionResult] = useState<any>(null);

  const load = async (ventureOverride?: string) => {
    const v = ventureOverride ?? selectedVenture;
    try {
      const q = v && v !== "all" ? `?venture=${encodeURIComponent(v)}` : "";
      const r = await fetch(`/api/control-plane${q}`, { cache: "no-store" });
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(selectedVenture);
    const id = setInterval(() => load(selectedVenture), 15000);
    return () => clearInterval(id);
  }, [selectedVenture]);

  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(action);
    setMsg("");
    setActionResult(null);
    try {
      const r = await fetch("/api/control-plane/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, venture: selectedVenture, ...payload }),
      });
      const j = await r.json();
      setActionResult(j);
      if (!j?.ok) setMsg(`Action failed: ${String(j?.error || "unknown")}`);
      else setMsg(`Action complete: ${action}`);
      await load();
    } catch (e: any) {
      setMsg(`Action failed: ${String(e?.message || e)}`);
    } finally {
      setBusy(null);
    }
  };

  const metrics = useMemo(() => {
    const sev = data?.securityChief?.severity || [];
    const critical = Number(sev.find((s: any) => s.severity === "critical")?.c || 0);
    const warn = Number(sev.find((s: any) => s.severity === "warn")?.c || 0);
    return {
      score: Number(data?.securityChief?.postureScore || 0),
      critical,
      warn,
      openTasks: (data?.securityChief?.openTasks || []).length,
      tgLive: Number(data?.integrations?.telegram?.livePublished || 0),
      queuePublished: Number(data?.queue?.published || 0),
    };
  }, [data]);

  if (loading) return (
    <div className="p-8 space-y-3">
      <div className="mc-skeleton h-7 w-56 rounded" />
      <div className="mc-skeleton h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="mc-skeleton h-20 rounded-xl" />
        <div className="mc-skeleton h-20 rounded-xl" />
        <div className="mc-skeleton h-20 rounded-xl" />
        <div className="mc-skeleton h-20 rounded-xl" />
      </div>
    </div>
  );
  if (!data?.ok) return <div className="p-8 text-red-400">Mission Control unavailable</div>;

  return (
    <div className="min-h-screen text-gray-100">
      <header className="sticky top-0 z-20 mc-glass border-b border-slate-800/70">
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mc-header-title mc-app-title">
              {data.organization?.assistantName || "Zuri"} Mission Control
            </h1>
            <p className="text-xs mc-subtle">
              {data.organization?.operator || "Operator"} · {new Date(data.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`mc-chip ${selectedVenture === "all" ? "mc-chip-warn" : "mc-chip-success"}`}>
              {selectedVenture === "all" ? "Context lock: ALL (restricted)" : `Context lock: ${selectedVenture}`}
            </span>
            <select
              value={selectedVenture}
              onChange={(e) => setSelectedVenture(e.target.value)}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            >
              <option value="all">All ventures</option>
              {(data.organization?.ventures || []).map((v: string) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <button
              onClick={() => load(selectedVenture)}
              className="inline-flex items-center gap-2 rounded-lg mc-btn-secondary px-3 py-2 text-sm"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <aside className="mc-card p-3 h-fit sticky top-20">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Navigation</p>
            <div className="flex lg:flex-col flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-all ${
                    tab === t.id ? "mc-btn-primary text-white" : "mc-btn-secondary"
                  }`}
                >
                  <t.icon size={15} /> {t.label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-slate-800 p-2">
              <p className="text-[11px] text-slate-400">Context lock</p>
              <p className="text-sm text-slate-200">{selectedVenture === "all" ? "ALL (restricted)" : selectedVenture}</p>
            </div>
          </aside>

          <section className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Tile title="Posture" value={metrics.score} />
              <Tile title="Critical" value={metrics.critical} danger />
              <Tile title="Warn" value={metrics.warn} warn />
              <Tile title="Open Tasks" value={metrics.openTasks} />
              <Tile title="TG Live" value={metrics.tgLive} />
              <Tile title="Queue Published" value={metrics.queuePublished} />
            </div>

            <div className="mc-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-slate-400">Command Center v2</p>
                <span className="mc-chip mc-chip-info">flow: intel → review → approval → publish</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-800 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">1) Intel</p>
                  <div className="space-y-2">
                    <ActionButton label="Generate Trend Intel" busy={busy === "trend_intel_generate"} onClick={() => act("trend_intel_generate")} disabled={selectedVenture === "all"} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">2) Review</p>
                  <div className="space-y-2">
                    <ActionButton label="Run Content Review" busy={busy === "run_content_review"} onClick={() => act("run_content_review")} disabled={selectedVenture === "all"} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">3) Approval</p>
                  <p className="text-[11px] text-slate-500 mb-2">Use Approval Queue table below for approve/rewrite/reject.</p>
                  <div className="space-y-2">
                    <ActionButton label="Run Full Chain (dryrun)" busy={busy === "run_full_chain"} onClick={() => act("run_full_chain", { platform: "x", mode: "dryrun", max: 10 })} disabled={selectedVenture === "all"} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">4) Publish</p>
                  <div className="space-y-2">
                    <ActionButton label="Queue Sync" busy={busy === "buffer_sync_queue"} onClick={() => act("buffer_sync_queue", { platform: "x", limit: 25 })} disabled={selectedVenture === "all"} />
                    <ActionButton label="Publish Dryrun" busy={busy === "buffer_publish_queue"} onClick={() => act("buffer_publish_queue", { mode: "dryrun", max: 10 })} disabled={selectedVenture === "all"} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
                <ActionButton label="Run Fire Drill" busy={busy === "run_fire_drill"} onClick={() => act("run_fire_drill")} danger />
                <ActionButton label="Run Drift Check" busy={busy === "run_drift_check"} onClick={() => act("run_drift_check")} />
                <ActionButton label="Security: Assign Tasks" busy={busy === "security_assign_tasks"} onClick={() => act("security_assign_tasks")} />
              </div>
            </div>

            {msg && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Last Action Result</p>
                <p className="text-sm text-slate-200">{msg}</p>
                {actionResult?.steps && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {actionResult.steps.map((s: any) => (
                      <div key={s.step} className={`rounded border px-2 py-2 text-xs ${s.ok ? 'border-green-800 bg-green-900/20 text-green-200' : 'border-red-800 bg-red-900/20 text-red-200'}`}>
                        <p className="font-medium">{s.step}</p>
                        <p>{s.ok ? 'ok' : 'failed'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mc-card p-5 mc-fade-in">
              {tab === "overview" && <Overview data={data} />}
              {tab === "workspace" && <WorkspaceLiteTab data={data} selectedVenture={selectedVenture} onRefresh={() => load(selectedVenture)} act={act} busy={busy} setMsg={setMsg} />}
              {tab === "security" && <SecurityTab data={data} act={act} busy={busy} />}
              {tab === "content" && <ContentTab data={data} />}
              {tab === "ventures" && <VenturesTab data={data} />}
              {tab === "runtime" && <RuntimeTab data={data} />}
              {tab === "forensics" && <ForensicsTab data={data} />}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Tile({ title, value, danger, warn }: any) {
  return (
    <div className="mc-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <p className={`text-2xl font-semibold ${danger ? "text-red-400" : warn ? "text-yellow-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function ActionButton({ label, busy, onClick, danger, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={`rounded-lg px-3 py-2 text-sm disabled:opacity-50 transition-all duration-150 ${danger ? "mc-btn-danger" : "mc-btn-primary"}`}
    >
      {busy ? "Running..." : label}
    </button>
  );
}

function Overview({ data }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Organization">
        <p className="text-sm text-slate-300 mb-2">Operator: {data.organization?.operator}</p>
        <div className="flex flex-wrap gap-2">
          {(data.organization?.ventures || []).map((v: string) => (
            <span key={v} className="rounded bg-slate-800 px-2 py-1 text-xs">{v}</span>
          ))}
        </div>
      </Card>
      <Card title="Systems Built">
        <ul className="space-y-1 text-sm text-slate-300">
          {(data.organization?.systemsBuilt || []).map((s: string, i: number) => <li key={i}>• {s}</li>)}
        </ul>
      </Card>
      <Card title="Immediate Actions">
        <ul className="space-y-1 text-sm text-slate-300">
          {(data.securityChief?.immediateActions || []).slice(0, 5).map((a: any, i: number) => (
            <li key={i}>• [{a.severity}] {a.title}</li>
          ))}
        </ul>
      </Card>
      <Card title="Integration Snapshot">
        <p className="text-sm text-slate-300">Telegram live: {data.integrations?.telegram?.livePublished || 0}</p>
        <p className="text-sm text-slate-300">Twitter live: {data.integrations?.twitter?.livePublished || 0}</p>
        <p className="text-sm text-slate-300">Ready to publish: {data.integrations?.outreach?.readyToPublish || 0}</p>
      </Card>
    </div>
  );
}

function WorkspaceLiteTab({ data, selectedVenture, onRefresh, act, busy, setMsg }: any) {
  const ws = data.workspaceLite || {};
  const decisions = ws.decisions || [];
  const board = String(ws.board || "");
  const decisionAuditByRender = ws.decisionAuditByRender || {};
  const summitMedia = ws.summitMedia || { total: 0, pendingReview: 0, recent: [], siteFeed: null };
  const mediaIntent = ws.mediaIntent || null;

  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docMsg, setDocMsg] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [ventureDocs, setVentureDocs] = useState<any[]>([]);
  const [docVersions, setDocVersions] = useState<string[]>([]);
  const [docComment, setDocComment] = useState("");
  const [docAssignTo, setDocAssignTo] = useState("");
  const [docAssignTask, setDocAssignTask] = useState("");
  const [docMeta, setDocMeta] = useState<any>({ comments: [], assignments: [] });

  const [linked, setLinked] = useState<any>({ decisions: [], queue: [], media: [] });

  const [mediaSource, setMediaSource] = useState("");
  const [mediaJobId, setMediaJobId] = useState("");
  const [mediaStage, setMediaStage] = useState("after");
  const [mediaServiceType, setMediaServiceType] = useState("");
  const [mediaZone, setMediaZone] = useState("");
  const [mediaCrew, setMediaCrew] = useState("");
  const [markMediaId, setMarkMediaId] = useState("");
  const [markNote, setMarkNote] = useState("");
  const [mediaFilterStage, setMediaFilterStage] = useState("all");
  const [mediaFilterZone, setMediaFilterZone] = useState("");
  const [mediaFilterService, setMediaFilterService] = useState("");

  const [cliAction, setCliAction] = useState("run_content_review");
  const [cliPayload, setCliPayload] = useState("{}");
  const [cliResult, setCliResult] = useState("");
  const [nlCommand, setNlCommand] = useState("Run full chain platform x dryrun max 10");
  const [nlHistory, setNlHistory] = useState<string[]>([]);
  const [nlSuggestions, setNlSuggestions] = useState<string[]>([
    "run full chain platform x dryrun max 10",
    "generate trend intel",
    "run content review platform x limit 20",
    "sync queue platform instagram limit 25",
    "publish dryrun max 10",
  ]);
  const [bufferPlatform, setBufferPlatform] = useState("x");
  const [bufferMode, setBufferMode] = useState("dryrun");

  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaStatus, setMediaStatus] = useState("all");
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [decisionSort, setDecisionSort] = useState<"score_desc" | "score_asc" | "confidence_desc" | "confidence_asc">("score_desc");
  const [queuePriorityFilter, setQueuePriorityFilter] = useState("all");
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");
  const [decisionPage, setDecisionPage] = useState(1);
  const [expandedDecisionId, setExpandedDecisionId] = useState("");
  const [selectedRenderIds, setSelectedRenderIds] = useState<string[]>([]);
  const [bulkSummary, setBulkSummary] = useState<string>("");
  const [bulkStats, setBulkStats] = useState<{ requested: number; changed: number; status: string } | null>(null);

  useEffect(() => {
    const run = async () => {
      const q = selectedVenture && selectedVenture !== "all" ? `?venture=${encodeURIComponent(selectedVenture)}` : "?venture=all";
      const r = await fetch(`/api/workspace-lite/docs${q}`);
      const j = await r.json();
      if (j?.ok) setVentureDocs(j.files || []);
    };
    run();
  }, [selectedVenture, data?.timestamp]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mc_decision_prefs");
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p?.filter) setDecisionFilter(p.filter);
      if (p?.sort) setDecisionSort(p.sort);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mc_nl_history");
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setNlHistory(arr.slice(0, 8));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mc_decision_prefs", JSON.stringify({ filter: decisionFilter, sort: decisionSort }));
    } catch {}
    setDecisionPage(1);
  }, [decisionFilter, decisionSort]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (!selectedRenderIds.length) return;
      if (e.key === "1") { e.preventDefault(); bulkUpdate("approved"); }
      if (e.key === "2") { e.preventDefault(); bulkUpdate("rewrite_needed"); }
      if (e.key === "3") { e.preventDefault(); bulkUpdate("rejected"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRenderIds, selectedVenture]);

  useEffect(() => {
    const run = async () => {
      if (selectedVenture === "all") {
        setMediaItems([]);
        setLinked({ decisions: [], queue: [], media: [] });
        return;
      }
      setMediaLoading(true);
      try {
        const q = new URLSearchParams({ venture: selectedVenture, status: mediaStatus, q: mediaQuery, limit: "40" });
        const r = await fetch(`/api/workspace-lite/media?${q.toString()}`);
        const j = await r.json();
        if (j?.ok) setMediaItems(j.items || []);

        const lr = await fetch(`/api/workspace-lite/linked?venture=${encodeURIComponent(selectedVenture)}`);
        const lj = await lr.json();
        if (lj?.ok) setLinked(lj.linked || { decisions: [], queue: [], media: [] });
      } finally {
        setMediaLoading(false);
      }
    };
    run();
  }, [selectedVenture, mediaStatus, mediaQuery, data?.timestamp]);

  const loadDoc = async (name: string) => {
    if (!name) return;
    const r = await fetch(`/api/workspace-lite/docs?name=${encodeURIComponent(name)}`);
    const j = await r.json();
    if (j?.ok) {
      setDocName(j.name);
      setDocContent(j.content || "");
      setDocMsg(`Loaded ${j.name}`);

      const vr = await fetch(`/api/workspace-lite/docs/version?name=${encodeURIComponent(j.name)}`);
      const vj = await vr.json();
      if (vj?.ok) setDocVersions(vj.versions || []);

      const mr = await fetch(`/api/workspace-lite/docs/meta?name=${encodeURIComponent(j.name)}`);
      const mj = await mr.json();
      if (mj?.ok) setDocMeta(mj.meta || { comments: [], assignments: [] });
    } else {
      setDocMsg("Could not load doc.");
    }
  };

  const snapshotDoc = async () => {
    if (!docName) return;
    const r = await fetch(`/api/workspace-lite/docs/version`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "snapshot", name: docName }),
    });
    const j = await r.json();
    if (j?.ok) {
      setDocMsg(`Snapshot created: ${j.version}`);
      const vr = await fetch(`/api/workspace-lite/docs/version?name=${encodeURIComponent(docName)}`);
      const vj = await vr.json();
      if (vj?.ok) setDocVersions(vj.versions || []);
    }
  };

  const restoreDocVersion = async (version: string) => {
    if (!docName || !version) return;
    if (!window.confirm(`Restore ${version}?`)) return;
    const r = await fetch(`/api/workspace-lite/docs/version`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "restore", name: docName, version, actor: "mission-control-ui" }),
    });
    const j = await r.json();
    if (j?.ok) {
      setDocMsg(`Restored ${version}`);
      await loadDoc(docName);
    }
  };

  const addDocComment = async () => {
    if (!docName || !docComment.trim()) return;
    const r = await fetch(`/api/workspace-lite/docs/meta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: docName, type: "comment", text: docComment, author: "K" }),
    });
    const j = await r.json();
    if (j?.ok) {
      setDocMeta(j.meta);
      setDocComment("");
    }
  };

  const addDocAssignment = async () => {
    if (!docName || !docAssignTo.trim() || !docAssignTask.trim()) return;
    const r = await fetch(`/api/workspace-lite/docs/meta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: docName, type: "assignment", assignee: docAssignTo, task: docAssignTask }),
    });
    const j = await r.json();
    if (j?.ok) {
      setDocMeta(j.meta);
      setDocAssignTo("");
      setDocAssignTask("");
    }
  };

  const updateDocAssignmentStatus = async (assignmentId: string, status: "open" | "resolved") => {
    if (!docName || !assignmentId) return;
    const r = await fetch(`/api/workspace-lite/docs/meta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: docName, type: "assignment_status", assignmentId, status }),
    });
    const j = await r.json();
    if (j?.ok) setDocMeta(j.meta);
  };

  const runCli = async () => {
    try {
      const parsed = cliPayload.trim() ? JSON.parse(cliPayload) : {};
      const r = await fetch("/api/control-plane/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "bot_cli_run", venture: selectedVenture, botAction: cliAction, botPayload: parsed }),
      });
      const j = await r.json();
      setCliResult(JSON.stringify(j, null, 2));
      onRefresh?.();
    } catch (e: any) {
      setCliResult(`CLI run failed: ${String(e?.message || e)}`);
    }
  };

  const runNl = async () => {
    try {
      const r = await fetch("/api/control-plane/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "bot_nl_run", venture: selectedVenture, text: nlCommand }),
      });
      const j = await r.json();
      setCliResult(JSON.stringify(j, null, 2));
      if (Array.isArray(j?.suggestions)) setNlSuggestions(j.suggestions);

      const next = [nlCommand, ...nlHistory.filter((x) => x !== nlCommand)].slice(0, 8);
      setNlHistory(next);
      try { localStorage.setItem("mc_nl_history", JSON.stringify(next)); } catch {}

      onRefresh?.();
    } catch (e: any) {
      setCliResult(`NL run failed: ${String(e?.message || e)}`);
    }
  };

  const filteredMedia = (summitMedia.recent || []).filter((m: any) => {
    if (mediaFilterStage !== "all" && String(m.stage || "") !== mediaFilterStage) return false;
    if (mediaFilterZone && !String(m.addressZone || "").toLowerCase().includes(mediaFilterZone.toLowerCase())) return false;
    if (mediaFilterService && !String(m.serviceType || "").toLowerCase().includes(mediaFilterService.toLowerCase())) return false;
    return true;
  });

  const filteredDecisions = (decisions || []).filter((d: any) => {
    if (decisionFilter === "all") return true;
    return String(d?.decision || "").toLowerCase() === decisionFilter;
  });

  const sortedDecisions = [...filteredDecisions].sort((a: any, b: any) => {
    const scoreA = Number(a?.score || 0);
    const scoreB = Number(b?.score || 0);
    const confA = Number(a?.confidence || 0);
    const confB = Number(b?.confidence || 0);
    if (decisionSort === "score_desc") return scoreB - scoreA;
    if (decisionSort === "score_asc") return scoreA - scoreB;
    if (decisionSort === "confidence_desc") return confB - confA;
    return confA - confB;
  });

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sortedDecisions.length / pageSize));
  const currentPage = Math.min(decisionPage, totalPages);
  const pagedDecisions = sortedDecisions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const siteJobs = (summitMedia.siteFeed?.jobs || []).slice(0, 12);
  const filteredQueue = (linked.queue || []).filter((q: any) => {
    if (queuePriorityFilter !== "all" && String(q?.priority || "") !== queuePriorityFilter) return false;
    if (queueStatusFilter !== "all" && String(q?.status || "") !== queueStatusFilter) return false;
    return true;
  });
  const filteredDecisionRenderIds = pagedDecisions.map((d: any) => String(d.renderId || "")).filter(Boolean);
  const allFilteredSelected = filteredDecisionRenderIds.length > 0 && filteredDecisionRenderIds.every((id: string) => selectedRenderIds.includes(id));

  const toggleRender = (id: string) => {
    setSelectedRenderIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const bulkUpdate = async (status: "approved" | "rewrite_needed" | "rejected") => {
    if (!selectedRenderIds.length) return;
    if (status === "rejected" && !window.confirm(`Reject ${selectedRenderIds.length} selected items?`)) return;
    const ids = [...selectedRenderIds];
    try {
      const r = await fetch("/api/control-plane/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "content_decision_bulk_update", venture: selectedVenture, renderIds: ids, status }),
      });
      const j = await r.json();
      if (j?.ok) {
        setBulkSummary(`Bulk updated ${j.changed}/${j.requested} items -> ${status}`);
        setBulkStats({ requested: Number(j.requested || ids.length), changed: Number(j.changed || 0), status });
        setMsg("Bulk moderation complete");
      } else {
        setBulkSummary(`Bulk update failed: ${String(j?.error || "unknown")}`);
        setBulkStats(null);
      }
      onRefresh?.();
    } catch (e: any) {
      setBulkSummary(`Bulk update failed: ${String(e?.message || e)}`);
      setBulkStats(null);
    }
    setSelectedRenderIds([]);
  };

  const saveDoc = async () => {
    if (!docName.trim()) {
      setDocMsg("Name required.");
      return;
    }
    setSavingDoc(true);
    setDocMsg("");
    try {
      if (docName.endsWith('.md')) {
        await fetch(`/api/workspace-lite/docs/version`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "snapshot", name: docName }),
        });
      }

      const r = await fetch(`/api/workspace-lite/docs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: docName, content: docContent, venture: selectedVenture }),
      });
      const j = await r.json();
      if (j?.ok) {
        setDocName(j.name);
        setDocMsg(`Saved ${j.name}`);
        onRefresh?.();
      } else {
        setDocMsg(`Save failed: ${String(j?.error || "unknown")}`);
      }
    } catch (e: any) {
      setDocMsg(`Save failed: ${String(e?.message || e)}`);
    } finally {
      setSavingDoc(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Portfolio Workspace Home">
        <p className="text-sm text-slate-300 mb-2">Context: <span className="text-white font-medium">{selectedVenture}</span></p>
        <p className="text-sm text-slate-300">Lanes: {(data.organization?.ventures || []).join(", ")}</p>
        <p className="text-sm text-slate-300">Content queue: {data.queue?.content || 0}</p>
        <p className="text-sm text-slate-300">Ready to publish: {data.integrations?.outreach?.readyToPublish || 0}</p>
        <p className="text-sm text-slate-300">Security posture: {data.securityChief?.postureScore || 0}</p>
      </Card>

      <Card title="Docs Library + Editor">
        <p className="text-xs text-slate-400 mb-2">Source: mission-control/docs + workspace-lite docs</p>
        <div className="flex gap-2 mb-2">
          <input
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="meeting-notes (auto-prefixed by venture)"
            className="mc-input flex-1"
          />
          <button onClick={saveDoc} disabled={savingDoc} className="rounded mc-btn-primary px-3 py-1 text-sm disabled:opacity-50">{savingDoc ? "Saving..." : "Save"}</button>
          <button onClick={snapshotDoc} className="rounded mc-btn-secondary px-3 py-1 text-sm">Snapshot</button>
        </div>
        <textarea
          value={docContent}
          onChange={(e) => setDocContent(e.target.value)}
          placeholder="Write notes, plans, and decisions here..."
          className="mc-textarea min-h-40 mb-2"
        />
        {docMsg && <p className="text-xs text-slate-300 mb-2">{docMsg}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
          <div className="rounded border border-slate-800 p-2">
            <p className="text-xs text-slate-400 mb-1">Versions</p>
            <ul className="space-y-1 max-h-24 overflow-y-auto text-xs">
              {docVersions.map((v) => (
                <li key={v}><button className="hover:underline" onClick={() => restoreDocVersion(v)}>{v}</button></li>
              ))}
              {!docVersions.length && <li className="text-slate-500">No versions yet.</li>}
            </ul>
          </div>
          <div className="rounded border border-slate-800 p-2">
            <p className="text-xs text-slate-400 mb-1">Comments & Assignments</p>
            <div className="space-y-1 mb-2">
              <input className="mc-input" value={docComment} onChange={(e) => setDocComment(e.target.value)} placeholder="Add comment" />
              <button className="rounded mc-btn-secondary px-2 py-1 text-xs" onClick={addDocComment}>Add Comment</button>
              <div className="grid grid-cols-2 gap-1">
                <input className="mc-input" value={docAssignTo} onChange={(e) => setDocAssignTo(e.target.value)} placeholder="Assign to" />
                <input className="mc-input" value={docAssignTask} onChange={(e) => setDocAssignTask(e.target.value)} placeholder="Task" />
              </div>
              <button className="rounded mc-btn-secondary px-2 py-1 text-xs" onClick={addDocAssignment}>Add Assignment</button>
            </div>
            <div className="space-y-2 max-h-28 overflow-y-auto text-xs">
              {(docMeta.comments || []).slice(-3).reverse().map((c: any) => (
                <div key={c.id || c.ts} className="rounded bg-slate-900/60 p-1">
                  <p className="text-slate-200">{c.text}</p>
                  <p className="text-slate-500">{c.author || "user"} · {new Date(c.ts).toLocaleString()}</p>
                </div>
              ))}
              {(docMeta.assignments || []).slice(-4).reverse().map((a: any) => (
                <div key={a.id || a.ts} className="rounded bg-slate-900/60 p-1 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-slate-200">{a.task}</p>
                    <p className="text-slate-500">{a.assignee} · {a.status || "open"}</p>
                  </div>
                  <button
                    className="rounded bg-slate-700 px-2 py-1 text-[11px]"
                    onClick={() => updateDocAssignmentStatus(String(a.id || ""), a.status === "resolved" ? "open" : "resolved")}
                  >
                    {a.status === "resolved" ? "Reopen" : "Resolve"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="space-y-1 text-sm text-slate-300 max-h-40 overflow-y-auto">
          {ventureDocs.map((d: any) => (
            <li key={d.path}>
              <button onClick={() => loadDoc(d.name)} className="hover:underline">• {d.name}</button>
            </li>
          ))}
          {!ventureDocs.length && <li className="text-slate-500">No docs found for this venture yet.</li>}
        </ul>
      </Card>

      <Card title="Approval Queue (Content Decisions)">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="rounded bg-slate-800 p-2"><p className="text-[11px] text-slate-400">Approve</p><p className="text-sm text-green-300">{(decisions||[]).filter((d:any)=>String(d.decision).toLowerCase()==='approve').length}</p></div>
          <div className="rounded bg-slate-800 p-2"><p className="text-[11px] text-slate-400">Rewrite</p><p className="text-sm text-amber-300">{(decisions||[]).filter((d:any)=>String(d.decision).toLowerCase()==='rewrite').length}</p></div>
          <div className="rounded bg-slate-800 p-2"><p className="text-[11px] text-slate-400">Reject</p><p className="text-sm text-red-300">{(decisions||[]).filter((d:any)=>String(d.decision).toLowerCase()==='reject').length}</p></div>
        </div>
        <div className="sticky top-0 z-10 rounded-lg border border-slate-800 bg-slate-900/95 p-2 mb-2 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-slate-400">Table view for fast approve/rewrite/reject triage</p>
          <div className="flex items-center gap-2">
            <button
              className="rounded bg-slate-700 px-2 py-1 text-xs"
              onClick={() => {
                if (allFilteredSelected) setSelectedRenderIds((prev) => prev.filter((id) => !filteredDecisionRenderIds.includes(id)));
                else setSelectedRenderIds((prev) => Array.from(new Set([...prev, ...filteredDecisionRenderIds])));
              }}
            >
              {allFilteredSelected ? "Unselect filtered" : "Select filtered"}
            </button>
            <button className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => setSelectedRenderIds(Array.from(new Set([...selectedRenderIds, ...filteredDecisionRenderIds.slice(0, 20)])))}>Select page</button>
            <button className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => setSelectedRenderIds([])}>Clear all</button>
            <button className="rounded bg-green-700 px-2 py-1 text-xs disabled:opacity-50" disabled={!selectedRenderIds.length} onClick={() => bulkUpdate("approved")}>Bulk Approve ({selectedRenderIds.length})</button>
            <button className="rounded bg-amber-700 px-2 py-1 text-xs disabled:opacity-50" disabled={!selectedRenderIds.length} onClick={() => bulkUpdate("rewrite_needed")}>Bulk Rewrite</button>
            <button className="rounded bg-red-700 px-2 py-1 text-xs disabled:opacity-50" disabled={!selectedRenderIds.length} onClick={() => bulkUpdate("rejected")}>Bulk Reject</button>
            <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className="mc-select">
              <option value="all">all</option>
              <option value="approve">approve</option>
              <option value="rewrite">rewrite</option>
              <option value="reject">reject</option>
            </select>
            <select value={decisionSort} onChange={(e) => setDecisionSort(e.target.value as any)} className="mc-select">
              <option value="score_desc">score ↓</option>
              <option value="score_asc">score ↑</option>
              <option value="confidence_desc">confidence ↓</option>
              <option value="confidence_asc">confidence ↑</option>
            </select>
          </div>
        </div>
        {bulkSummary && <p className="text-xs text-slate-300 mb-1">{bulkSummary}</p>}
        {bulkStats && (
          <div className="flex gap-2 mb-2 text-[11px]">
            <span className="mc-chip mc-chip-info">requested {bulkStats.requested}</span>
            <span className="mc-chip mc-chip-success">changed {bulkStats.changed}</span>
            <span className="mc-chip mc-chip-info">status {bulkStats.status}</span>
          </div>
        )}
        <p className="text-[11px] text-slate-500 mb-2">Shortcuts: Ctrl/Cmd+1 approve · Ctrl/Cmd+2 rewrite · Ctrl/Cmd+3 reject (selected items)</p>
        {!!filteredDecisions.length && (
          <div className="overflow-auto border border-slate-800 rounded-lg">
            <table className="w-full mc-table">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left px-2 py-2">Sel</th>
                  <th className="text-left px-2 py-2">Decision</th>
                  <th className="text-left px-2 py-2">Score</th>
                  <th className="text-left px-2 py-2">Confidence</th>
                  <th className="text-left px-2 py-2">Preview</th>
                </tr>
              </thead>
              <tbody>
                {pagedDecisions.map((d: any) => {
                  const rowId = d.reviewId || `${d.ts}-${d.renderId}`;
                  const isOpen = expandedDecisionId === rowId;
                  return (
                    <Fragment key={rowId}>
                      <tr className="border-t border-slate-800 text-slate-200 cursor-pointer hover:bg-slate-800/40" onClick={() => setExpandedDecisionId(isOpen ? "" : rowId)}>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedRenderIds.includes(String(d.renderId || ''))} onChange={() => toggleRender(String(d.renderId || ''))} />
                        </td>
                        <td className="px-2 py-2">
                          <span className={`rounded px-2 py-1 ${String(d.decision).toLowerCase()==='approve' ? 'mc-chip mc-chip-success' : String(d.decision).toLowerCase()==='reject' ? 'mc-chip mc-chip-danger' : 'mc-chip mc-chip-warn'}`}>
                            {String(d.decision || 'unknown').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 py-2">{d.score}</td>
                        <td className="px-2 py-2">{Number(d.confidence || 0).toFixed(2)}</td>
                        <td className="px-2 py-2">{String(d.preview || '').slice(0, 120)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-slate-800 bg-slate-900/50 text-slate-300">
                          <td colSpan={5} className="px-3 py-3 space-y-2">
                            <p className="text-xs"><span className="text-slate-400">Rationale:</span> {(d?.evidence?.llm?.reasons || []).join('; ') || 'n/a'}</p>
                            {!!(d?.failureTaxonomy || []).length && <p className="text-xs"><span className="text-slate-400">Failure tags:</span> {(d.failureTaxonomy || []).join(', ')}</p>}
                            {d?.rewriteStrategy && <p className="text-xs"><span className="text-slate-400">Rewrite strategy:</span> {d.rewriteStrategy}</p>}
                            <div className="flex gap-2 flex-wrap">
                              <button className="rounded bg-green-700 px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); act('content_decision_update', { renderId: d.renderId, status: 'approved' }); }}>Approve</button>
                              <button className="rounded bg-amber-700 px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); act('content_decision_update', { renderId: d.renderId, status: 'rewrite_needed' }); }}>Rewrite</button>
                              <button className="rounded bg-red-700 px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); if (window.confirm('Reject this item?')) act('content_decision_update', { renderId: d.renderId, status: 'rejected' }); }}>Reject</button>
                              <button className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); act('content_decision_undo', { renderId: d.renderId }); }}>Undo Last</button>
                            </div>
                            {decisionAuditByRender?.[String(d.renderId || "")] && (
                              <p className="text-[11px] text-slate-400">
                                Last change: {decisionAuditByRender[String(d.renderId)].action} · {decisionAuditByRender[String(d.renderId)].fromStatus} → {decisionAuditByRender[String(d.renderId)].toStatus} · {new Date(decisionAuditByRender[String(d.renderId)].ts).toLocaleString()}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!!filteredDecisions.length && (
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <p>Page {currentPage} of {totalPages} · {sortedDecisions.length} items</p>
            <div className="flex gap-2">
              <button className="rounded bg-slate-800 px-2 py-1 disabled:opacity-50" disabled={currentPage <= 1} onClick={() => setDecisionPage((p) => Math.max(1, p - 1))}>Prev</button>
              <button className="rounded bg-slate-800 px-2 py-1 disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setDecisionPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        )}
        {!filteredDecisions.length && (
          <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-4 text-xs text-slate-400">
            No decisions for this filter/context yet. Run Trend Intel + Content Review to populate this queue.
          </div>
        )}
      </Card>

      <Card title="Review Board (Markdown)">
        <pre className="whitespace-pre-wrap text-xs text-slate-300 max-h-80 overflow-y-auto">{board || "No board yet. Run content review to populate."}</pre>
      </Card>

      <Card title="Bot Command Center (Workspace)">
        <p className="text-xs text-slate-400 mb-2">Direct bot commands from Mission Control. Summit intake is enabled now.</p>
        <div className="grid grid-cols-1 gap-2 mb-2">
          <input value={mediaSource} onChange={(e) => setMediaSource(e.target.value)} placeholder="/absolute/path/to/photo.jpg" className="mc-input" />
          <div className="grid grid-cols-2 gap-2">
            <input value={mediaJobId} onChange={(e) => setMediaJobId(e.target.value)} placeholder="Job ID (e.g., SUM-2026-001)" className="mc-input" />
            <select value={mediaStage} onChange={(e) => setMediaStage(e.target.value)} className="mc-select">
              <option value="before">before</option>
              <option value="during">during</option>
              <option value="after">after</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={mediaServiceType} onChange={(e) => setMediaServiceType(e.target.value)} placeholder="serviceType" className="mc-input" />
            <input value={mediaZone} onChange={(e) => setMediaZone(e.target.value)} placeholder="zone" className="mc-input" />
            <input value={mediaCrew} onChange={(e) => setMediaCrew(e.target.value)} placeholder="crew" className="mc-input" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Ingest Summit Photo"
            busy={busy === "summit_media_ingest"}
            onClick={() => act("summit_media_ingest", { source: mediaSource, jobId: mediaJobId, stage: mediaStage, serviceType: mediaServiceType, zone: mediaZone, crew: mediaCrew })}
            disabled={selectedVenture !== "summit"}
          />
          <ActionButton
            label="View Summit Queue"
            busy={busy === "summit_media_queue"}
            onClick={() => act("summit_media_queue")}
            disabled={selectedVenture !== "summit"}
          />
          <ActionButton
            label="Export Summit Site Feed"
            busy={busy === "summit_media_export_site"}
            onClick={() => act("summit_media_export_site")}
            disabled={selectedVenture !== "summit"}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 mt-3">
          <input value={markMediaId} onChange={(e) => setMarkMediaId(e.target.value)} placeholder="mediaId to mark (from list below)" className="mc-input" />
          <input value={markNote} onChange={(e) => setMarkNote(e.target.value)} placeholder="note (optional)" className="mc-input" />
          <div className="flex flex-wrap gap-2">
            <ActionButton
              label="Approve for Website"
              busy={busy === "summit_media_mark"}
              onClick={() => act("summit_media_mark", { mediaId: markMediaId, websiteReady: true, privacyChecked: true, publishState: "approved", flag: "approved", note: markNote })}
              disabled={selectedVenture !== "summit" || !markMediaId}
            />
            <ActionButton
              label="Flag Item"
              busy={busy === "summit_media_mark"}
              onClick={() => act("summit_media_mark", { mediaId: markMediaId, publishState: "drafted", flag: "needs_review", note: markNote })}
              disabled={selectedVenture !== "summit" || !markMediaId}
              danger
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Tip: switch venture to summit to enable intake commands.</p>
      </Card>

      <Card title="Publishing Command Chain (venture)">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={bufferPlatform} onChange={(e) => setBufferPlatform(e.target.value)} placeholder="platform (x/facebook/instagram)" className="mc-input" />
          <select value={bufferMode} onChange={(e) => setBufferMode(e.target.value)} className="mc-select">
            <option value="dryrun">dryrun</option>
            <option value="live">live</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="1) Generate Trend Intel" busy={busy === "trend_intel_generate"} onClick={() => act("trend_intel_generate")} disabled={selectedVenture === "all"} />
          <ActionButton label="2) Sync Approved -> Queue" busy={busy === "buffer_sync_queue"} onClick={() => act("buffer_sync_queue", { platform: bufferPlatform, limit: 25 })} disabled={selectedVenture === "all"} />
          <ActionButton label="3) Publish Queue" busy={busy === "buffer_publish_queue"} onClick={() => act("buffer_publish_queue", { mode: bufferMode, max: 10 })} disabled={selectedVenture === "all"} />
        </div>
        <p className="text-xs text-slate-500 mt-2">Enforced gate: no queue sync without an intelligence pack for the selected venture.</p>
      </Card>

      <Card title="Venture Media Intent Hints">
        {mediaIntent ? (
          <div className="space-y-2 text-xs text-slate-300">
            <p><span className="text-slate-400">Primary use:</span> {(mediaIntent.primaryUse || []).join(', ')}</p>
            <p><span className="text-slate-400">Asset types:</span> {(mediaIntent.assetTypes || []).join(', ')}</p>
            <p><span className="text-slate-400">Review priorities:</span> {(mediaIntent.reviewPriorities || []).join(', ')}</p>
            <p><span className="text-slate-400">Avoid:</span> {(mediaIntent.avoid || []).join(', ')}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No venture-specific media intent policy loaded for this context.</p>
        )}
      </Card>

      <Card title="Summit Media Library">
        <p className="text-sm text-slate-300">Total media: {summitMedia.total || 0}</p>
        <p className="text-sm text-slate-300">Pending review: {summitMedia.pendingReview || 0}</p>
        <p className="text-xs text-slate-400 mb-2">Site feed exported: {summitMedia.siteFeed?.exported || 0} items / {summitMedia.siteFeed?.jobs?.length || 0} jobs</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <select value={mediaFilterStage} onChange={(e) => setMediaFilterStage(e.target.value)} className="mc-select">
            <option value="all">all stages</option>
            <option value="before">before</option>
            <option value="during">during</option>
            <option value="after">after</option>
          </select>
          <input value={mediaFilterZone} onChange={(e) => setMediaFilterZone(e.target.value)} placeholder="filter zone" className="mc-select" />
          <input value={mediaFilterService} onChange={(e) => setMediaFilterService(e.target.value)} placeholder="filter service" className="mc-select" />
        </div>
        <ul className="space-y-1 text-xs text-slate-300 max-h-48 overflow-y-auto">
          {filteredMedia.map((m: any) => (
            <li key={m.mediaId}>• {m.jobId} [{m.stage}] {m.filename} · {m.serviceType || "n/a"} · {m.addressZone || "n/a"} · score {m.readinessScore ?? "-"} · {m.publishState || "drafted"}</li>
          ))}
          {!filteredMedia.length && <li className="text-slate-500">No Summit media matches current filters.</li>}
        </ul>
      </Card>

      <Card title="Media Explorer (all ventures)">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input className="mc-input" value={mediaQuery} onChange={(e) => setMediaQuery(e.target.value)} placeholder="search job/service/notes" />
          <select className="mc-select" value={mediaStatus} onChange={(e) => setMediaStatus(e.target.value)}>
            <option value="all">all status</option>
            <option value="drafted">drafted</option>
            <option value="approved">approved</option>
            <option value="published">published</option>
            <option value="rewrite_needed">rewrite_needed</option>
          </select>
          <div className="text-xs text-slate-400 flex items-center">Context: {selectedVenture}</div>
        </div>
        {selectedVenture === "all" ? (
          <p className="text-xs text-slate-500">Select a venture to explore its media library.</p>
        ) : mediaLoading ? (
          <div className="mc-skeleton h-24 rounded" />
        ) : (
          <ul className="space-y-1 text-xs text-slate-300 max-h-56 overflow-y-auto">
            {mediaItems.map((m: any) => (
              <li key={m.mediaId}>• {m.jobId || "n/a"} [{m.stage || "n/a"}] {m.filename || "file"} · {m.publishState || m.status || "n/a"}</li>
            ))}
            {!mediaItems.length && <li className="text-slate-500">No media found for current filters.</li>}
          </ul>
        )}
      </Card>

      <Card title="Job Timeline (Summit)">
        <ul className="space-y-2 text-xs text-slate-300 max-h-56 overflow-y-auto">
          {siteJobs.map((j: any) => (
            <li key={j.jobId} className="rounded bg-slate-800 p-2">
              <p className="font-medium">{j.jobId} · {j.serviceType || "service"} · {j.zone || "zone"}</p>
              <p className="text-slate-400">Shots: {(j.items || []).length} | stages: {[...new Set((j.items || []).map((x: any) => x.stage))].join(", ")}</p>
            </li>
          ))}
          {!siteJobs.length && <li className="text-slate-500">No job timeline entries yet (approve + export first).</li>}
        </ul>
      </Card>

      <Card title="Bot CLI Console (allowlisted)">
        <div className="grid grid-cols-1 gap-2 mb-2">
          <input value={nlCommand} onChange={(e) => setNlCommand(e.target.value)} className="mc-input" placeholder="Natural language command (e.g. run full chain platform x dryrun max 10)" />
          <button onClick={runNl} className="rounded mc-btn-secondary px-3 py-2 text-sm">Run Natural Language Command</button>
          {!!nlSuggestions.length && (
            <div className="flex flex-wrap gap-2">
              {nlSuggestions.slice(0, 5).map((s) => (
                <button key={s} onClick={() => setNlCommand(s)} className="mc-chip mc-chip-info">{s}</button>
              ))}
            </div>
          )}
          {!!nlHistory.length && (
            <div className="flex flex-wrap gap-2">
              {nlHistory.map((h) => (
                <button key={h} onClick={() => setNlCommand(h)} className="mc-chip mc-chip-warn">{h}</button>
              ))}
            </div>
          )}
          <select value={cliAction} onChange={(e) => setCliAction(e.target.value)} className="mc-select">
            <option value="run_content_review">run_content_review</option>
            <option value="trend_intel_generate">trend_intel_generate</option>
            <option value="buffer_sync_queue">buffer_sync_queue</option>
            <option value="buffer_publish_queue">buffer_publish_queue</option>
            <option value="run_full_chain">run_full_chain</option>
            <option value="summit_media_queue">summit_media_queue</option>
            <option value="summit_media_export_site">summit_media_export_site</option>
            <option value="summit_media_mark">summit_media_mark</option>
          </select>
          <textarea value={cliPayload} onChange={(e) => setCliPayload(e.target.value)} className="mc-textarea min-h-24 text-xs" />
          <button onClick={runCli} className="rounded mc-btn-primary px-3 py-2 text-sm">Run Structured CLI Action</button>
        </div>
        <pre className="whitespace-pre-wrap text-xs text-slate-300 max-h-48 overflow-y-auto">{cliResult || "Result will appear here"}</pre>
      </Card>

      <Card title="Linked Records">
        {selectedVenture === "all" ? (
          <p className="text-xs text-slate-500">Select a venture to view linked records.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-slate-800 p-2">
              <p className="text-slate-400 mb-1">Recent Decisions</p>
              <ul className="space-y-1 max-h-36 overflow-y-auto">{(linked.decisions || []).map((d: any) => <li key={d.reviewId || d.ts}>• {d.decision} · {d.score}</li>)}</ul>
            </div>
            <div className="rounded border border-slate-800 p-2 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400">Automation Backlog (table)</p>
                <div className="flex gap-1">
                  <select className="mc-select" value={queuePriorityFilter} onChange={(e) => setQueuePriorityFilter(e.target.value)}>
                    <option value="all">priority: all</option>
                    <option value="P0">P0</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                  </select>
                  <select className="mc-select" value={queueStatusFilter} onChange={(e) => setQueueStatusFilter(e.target.value)}>
                    <option value="all">status: all</option>
                    <option value="planned">planned</option>
                    <option value="in_progress">in_progress</option>
                    <option value="done">done</option>
                  </select>
                </div>
              </div>
              <div className="overflow-auto border border-slate-800 rounded-lg">
                <table className="w-full mc-table">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="text-left px-2 py-1">Priority</th>
                      <th className="text-left px-2 py-1">Title</th>
                      <th className="text-left px-2 py-1">Status</th>
                      <th className="text-left px-2 py-1">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map((q: any) => (
                      <tr key={q.id} className="border-t border-slate-800 text-slate-200">
                        <td className="px-2 py-1">{q.priority || "-"}</td>
                        <td className="px-2 py-1">{q.title || "-"}</td>
                        <td className="px-2 py-1">{q.status || "-"}</td>
                        <td className="px-2 py-1">{q.owner || "-"}</td>
                      </tr>
                    ))}
                    {!filteredQueue.length && (
                      <tr>
                        <td colSpan={4} className="px-2 py-2 text-slate-500">No backlog items for current filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded border border-slate-800 p-2 md:col-span-3">
              <p className="text-slate-400 mb-1">Media Links</p>
              <ul className="space-y-1 max-h-36 overflow-y-auto">{(linked.media || []).map((m: any) => <li key={m.mediaId}>• {m.jobId || "n/a"} [{m.stage || "n/a"}]</li>)}</ul>
            </div>
          </div>
        )}
      </Card>

      <Card title="Recent Bot Commands">
        <ul className="space-y-2 text-xs text-slate-300 max-h-48 overflow-y-auto">
          {(data.recentActions || []).slice(0, 12).map((a: any, i: number) => (
            <li key={i} className="rounded bg-slate-800 p-2">
              <div className="flex justify-between"><span>{a.action}</span><span className={a.ok ? "text-green-400" : "text-red-400"}>{a.ok ? "ok" : "fail"}</span></div>
              <p className="text-slate-400">{new Date(a.ts).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SecurityTab({ data, act, busy }: any) {
  const pending = data.securityChief?.pendingByStage || { chief: 0, zuri: 0, user: 0 };
  const assignments = data.securityChief?.assignments || [];
  const tasks = data.securityChief?.openTasks || [];
  const queue = data.securityChief?.remediationQueue || {};
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id || "");
  const selectedTask = tasks.find((t: any) => t.id === selectedTaskId) || tasks[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Approval Queue">
        <p className="text-sm text-slate-300 mb-2">Pending → Chief: {pending.chief || 0} · Zuri: {pending.zuri || 0} · User: {pending.user || 0}</p>
        <div className="grid grid-cols-1 gap-2 mb-3">
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Approve Next (Chief)" busy={busy === "security_approve_next_chief"} onClick={() => act("security_approve_next_chief")} />
            <ActionButton label="Reject Next (Chief)" busy={busy === "security_reject_next_chief"} onClick={() => act("security_reject_next_chief")} danger />
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Approve Next (Zuri)" busy={busy === "security_approve_next_zuri"} onClick={() => act("security_approve_next_zuri")} />
            <ActionButton label="Reject Next (Zuri)" busy={busy === "security_reject_next_zuri"} onClick={() => act("security_reject_next_zuri")} danger />
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Approve Next (User)" busy={busy === "security_approve_next_user"} onClick={() => act("security_approve_next_user")} />
            <ActionButton label="Reject Next (User)" busy={busy === "security_reject_next_user"} onClick={() => act("security_reject_next_user")} danger />
          </div>
        </div>
        <ul className="space-y-1 text-xs text-slate-300 max-h-44 overflow-y-auto">
          {assignments.filter((a: any) => a.status === "pending").slice(0, 12).map((a: any) => (
            <li key={a.id}>• {a.worker_name || a.worker_id} → {a.task_id} [{a.stage}]</li>
          ))}
        </ul>
      </Card>

      <Card title="Remediation Queue">
        <p className="text-xs text-slate-400 mb-2">Open: {queue.totalOpenTasks || 0} · In progress: {queue.inProgressTasks || 0} · Pending assignments: {queue.pendingAssignments || 0}</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {tasks.slice(0, 20).map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className={`w-full text-left rounded p-2 border ${selectedTask?.id === t.id ? "border-blue-500 bg-slate-800" : "border-slate-700 bg-slate-900"}`}
            >
              <p className="text-xs text-slate-400">[{t.severity}] {t.status} · owner: {t.owner || "Security Chief"}</p>
              <p className="text-sm text-slate-200">{t.title}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Task Detail">
        {!selectedTask ? (
          <p className="text-sm text-slate-400">No task selected.</p>
        ) : (
          <div className="space-y-2 text-sm text-slate-300">
            <p><span className="text-slate-400">ID:</span> {selectedTask.id}</p>
            <p><span className="text-slate-400">Title:</span> {selectedTask.title}</p>
            <p><span className="text-slate-400">Severity:</span> {selectedTask.severity}</p>
            <p><span className="text-slate-400">Status:</span> {selectedTask.status}</p>
            <p><span className="text-slate-400">Owner:</span> {selectedTask.owner || "Security Chief"}</p>
            <p><span className="text-slate-400">Due:</span> {selectedTask.due_at || "n/a"}</p>
            <p><span className="text-slate-400">Source risk:</span> {selectedTask.source_risk || "n/a"}</p>
            <p><span className="text-slate-400">Description:</span> {selectedTask.description || "n/a"}</p>
          </div>
        )}
      </Card>

      <Card title="Top Risks">
        <ul className="space-y-2 text-sm text-slate-300">
          {(data.securityChief?.topRisks || []).slice(0, 5).map((r: any, i: number) => (
            <li key={i}>• {r.scenario} [{r.residual_risk}] ({Math.round((r.detection_coverage || 0) * 100)}%)</li>
          ))}
        </ul>
      </Card>

      <Card title="Top Signals">
        <ul className="space-y-1 text-sm text-slate-300">
          {(data.securityChief?.topSignals || []).map((s: any, i: number) => (
            <li key={i}>• {s.event_type}: {s.c}</li>
          ))}
        </ul>
      </Card>

      <Card title="Health">
        <p className="text-sm text-slate-300">Posture score: {data.securityChief?.postureScore}</p>
        <p className="text-sm text-slate-300">Daily scheduler: {String(data.services?.securityChiefDaily || "n/a").split("\n")[0]}</p>
        <p className="text-sm text-slate-300">Weekly scheduler: {String(data.services?.securityChiefWeekly || "n/a").split("\n")[0]}</p>
      </Card>
    </div>
  );
}

function ContentTab({ data }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Social Drafts (Live)">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {(data.integrations?.socialDrafts || []).map((d: any, i: number) => (
            <div key={i} className="rounded bg-slate-800 p-2 text-xs">
              <div className="flex justify-between text-slate-400 mb-1">
                <span>{d.venture}</span>
                <span>{d.platform} · {d.status}</span>
              </div>
              <p className="text-slate-200">{String(d.text || "").slice(0, 180)}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Content Library">
        <p className="text-sm text-slate-300">Approved: {data.integrations?.contentLibrary?.approved || 0}</p>
        <p className="text-sm text-slate-300 mb-2">Published: {data.integrations?.contentLibrary?.published || 0}</p>
        <ul className="space-y-1 text-xs text-slate-300">
          {(data.integrations?.contentLibrary?.byPlatform || []).map((r: any, i: number) => (
            <li key={i}>• {r.platform}/{r.status}: {r.c}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function VenturesTab({ data }: any) {
  const profiles = data.organization?.ventureProfiles || {};
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(profiles).map(([name, cfg]: any) => (
        <Card key={name} title={name}>
          <p className="text-xs text-slate-400 mb-1">channels: {(cfg.channels || []).join(", ")}</p>
          <p className="text-xs text-slate-400 mb-1">riskTolerance: {cfg.riskTolerance}</p>
          <p className="text-xs text-slate-400">approvalThreshold: {cfg.approvalThreshold}</p>
        </Card>
      ))}
    </div>
  );
}

function RuntimeTab({ data }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Runtime Policy">
        <ul className="space-y-1 text-sm text-slate-300">
          {Object.entries(data.runtimeControl || {}).map(([k, v]) => (
            <li key={k}>• {k}: {String(v)}</li>
          ))}
        </ul>
      </Card>
      <Card title="Services">
        <ul className="space-y-2 text-xs text-slate-300">
          {Object.entries(data.services || {}).map(([k, v]) => (
            <li key={k} className="rounded bg-slate-800 p-2">
              <p className="font-medium mb-1">{k}</p>
              <pre className="whitespace-pre-wrap">{String(v)}</pre>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function ForensicsTab({ data }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Recent Actions">
        <ul className="space-y-2 text-xs text-slate-300">
          {(data.recentActions || []).slice(0, 12).map((a: any, i: number) => (
            <li key={i} className="rounded bg-slate-800 p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{a.action}</span>
                <span className={a.ok ? "text-green-400" : "text-red-400"}>{a.ok ? "ok" : "fail"}</span>
              </div>
              <p className="text-slate-400">{new Date(a.ts).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Queue + Delivery">
        <p className="text-sm text-slate-300">Published queue events: {data.queue?.published || 0}</p>
        <p className="text-sm text-slate-300">Outreach approvals: {data.integrations?.outreach?.approvals || 0}</p>
        <p className="text-sm text-slate-300">Telegram live sent: {data.integrations?.telegram?.livePublished || 0}</p>
      </Card>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="mc-card p-4">
      <h3 className="mb-3 font-semibold text-sm text-white tracking-wide">{title}</h3>
      {children}
    </div>
  );
}
