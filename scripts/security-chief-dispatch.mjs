#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readChiefConfig } from "./security-chief-config.mjs";

process.env.PATH = `/Users/terminal/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH ?? ""}`;

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const cfg = readChiefConfig();
const channel = arg("channel", process.env.SECURITY_CHIEF_CHANNEL || cfg.routing?.channel || "telegram");
const target = arg("target", process.env.SECURITY_CHIEF_CHAT_ID || cfg.routing?.target || "");
const severity = arg("severity", "info");
const message = arg("message", "").trim();

if (!message) {
  console.error("security-chief-dispatch requires --message");
  process.exit(1);
}
if (!target) {
  console.error("security-chief-dispatch missing target");
  process.exit(1);
}

const who = `${cfg.identity?.emoji || "🛡️"} ${cfg.identity?.name || "Security Chief"}`;
const composed = `[${who} | ${severity.toUpperCase()}]\n${message}`;

try {
  execSync(`/Users/terminal/.npm-global/bin/openclaw message send --channel ${channel} --target ${target} --message ${JSON.stringify(composed)}`, { stdio: "ignore" });
  console.log(JSON.stringify({ ok: true, channel, target }));
} catch (e) {
  console.error(`[security-chief-dispatch.send_failed] ${String(e?.message || e)}`);
  process.exit(1);
}
