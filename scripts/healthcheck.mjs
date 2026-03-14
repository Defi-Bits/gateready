#!/usr/bin/env node

const baseUrl = process.env.MISSION_CONTROL_URL ?? "http://127.0.0.1:3000";
const healthUrl = `${baseUrl.replace(/\/$/, "")}/api/health`;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch(healthUrl, { signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`Health endpoint returned HTTP ${res.status}`);
  }

  const body = await res.json();
  if (!body?.ok) {
    throw new Error(`Health payload did not include ok=true: ${JSON.stringify(body)}`);
  }

  console.log("[healthcheck] PASS", JSON.stringify({
    url: healthUrl,
    service: body.service,
    environment: body.environment,
    store: body.store,
    timestamp: body.timestamp,
  }));
} catch (error) {
  clearTimeout(timeout);
  console.error("[healthcheck] FAIL", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
