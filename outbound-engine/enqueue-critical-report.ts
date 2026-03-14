import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PostgresDurableWorkerAdapter } from "./postgres-adapter";
import { SqliteDurableWorkerAdapter } from "./sqlite-adapter";

type Args = Record<string, string>;

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    out[key] = value;
  }
  return out;
}

function isoHourBucket(iso: string): string {
  return `${iso.slice(0, 13)}:00:00.000Z`;
}

function loadRouteDefaults() {
  const cfgPath = process.env.ROUTE_CONFIG_PATH ?? join(process.cwd(), "scripts", "route-config.json");
  try {
    const raw = readFileSync(cfgPath, "utf8");
    const cfg = JSON.parse(raw) as {
      primary?: { channel?: string; target?: string };
      fallback?: { channels?: string[]; targets?: string[] };
    };
    return {
      primaryChannel: cfg.primary?.channel ?? "",
      primaryTarget: cfg.primary?.target ?? "",
      fallbackChannels: cfg.fallback?.channels ?? [],
      fallbackTargets: cfg.fallback?.targets ?? [],
    };
  } catch {
    return { primaryChannel: "", primaryTarget: "", fallbackChannels: [], fallbackTargets: [] };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const reportType = args.reportType;
  const severity = args.severity ?? "critical";
  const message = args.message;

  if (!reportType || !message) {
    throw new Error("Usage: --reportType <name> --message <text> [--severity critical|warn|info]");
  }

  const runAt = args.runAt ?? new Date().toISOString();
  const windowStart = args.windowStart ?? isoHourBucket(new Date().toISOString());
  const maxAttempts = Number(args.maxAttempts ?? process.env.CRITICAL_REPORT_MAX_ATTEMPTS ?? 6);

  const routeDefaults = loadRouteDefaults();

  const primaryChannel =
    args.primaryChannel ??
    process.env.CRITICAL_REPORT_PRIMARY_CHANNEL ??
    process.env.REPORT_PRIMARY_CHANNEL ??
    routeDefaults.primaryChannel;
  const primaryTarget =
    args.primaryTarget ??
    process.env.CRITICAL_REPORT_PRIMARY_TARGET ??
    process.env.REPORT_PRIMARY_TARGET ??
    routeDefaults.primaryTarget;

  const fallbackChannelsRaw =
    args.fallbackChannels ?? process.env.CRITICAL_REPORT_FALLBACK_CHANNELS ?? routeDefaults.fallbackChannels.join(",");
  const fallbackTargetsRaw =
    args.fallbackTargets ?? process.env.CRITICAL_REPORT_FALLBACK_TARGETS ?? routeDefaults.fallbackTargets.join(",");

  const fallbackChannels = fallbackChannelsRaw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const fallbackTargets = fallbackTargetsRaw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const payload = {
    reportType,
    severity,
    message,
    windowStart,
    generatedAt: new Date().toISOString(),
    primaryChannel,
    primaryTarget,
    fallbackChannels,
    fallbackTargets,
  };

  const idempotencyKey = `report:${reportType}:${windowStart}`;

  const store = process.env.OUTBOUND_STORE ?? "sqlite";
  const adapter =
    store === "postgres"
      ? new PostgresDurableWorkerAdapter(process.env.DATABASE_URL ?? "")
      : new SqliteDurableWorkerAdapter(process.env.OUTBOUND_SQLITE_PATH);

  await adapter.enqueueJob("CriticalReportDispatch", runAt, payload, idempotencyKey, maxAttempts);
  await adapter.appendAudit("CriticalReportEnqueued", {
    enqueueId: randomUUID(),
    reportType,
    severity,
    idempotencyKey,
    runAt,
    maxAttempts,
    route: {
      primaryChannel,
      primaryTarget,
      fallbackChannels,
      fallbackTargets,
    },
  });

  console.log(
    JSON.stringify({
      ok: true,
      jobType: "CriticalReportDispatch",
      reportType,
      idempotencyKey,
      runAt,
      maxAttempts,
    }),
  );
}

main().catch((err) => {
  console.error("[enqueue-critical-report]", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
