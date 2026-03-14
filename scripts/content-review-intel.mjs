#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const WORKSPACE = '/Users/terminal/.openclaw/workspace';
const DB_PATH = process.env.CONTENT_LIBRARY_DB || join(ROOT, 'state', 'content-library.db');
const QC_POLICY_PATH = join(WORKSPACE, 'shared-core', 'policies', 'content-qc-policy.json');
const OMNI_POLICY_PATH = join(WORKSPACE, 'shared-core', 'policies', 'omnichannel-standards.json');
const REVIEW_POLICY_DIR = join(WORKSPACE, 'shared-core', 'policies', 'content-review');
const DECISIONS_PATH = join(ROOT, 'state', 'content-review-decisions.jsonl');
const FEEDBACK_PATH = join(ROOT, 'state', 'content-review-feedback.jsonl');
const DRIFT_DIR = join(ROOT, 'state', 'content-review-drift');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}
function readJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function readJsonl(path) {
  try { return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}
function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }
function clip(s, n = 160) { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length <= n ? t : `${t.slice(0, n - 1)}…`; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

const platform = arg('platform', 'x');
const venture = arg('venture', '');
const allowAll = arg('allowAll', 'false') === 'true';
const limit = Number(arg('limit', '20'));
const dryRun = arg('dryRun', 'false') === 'true';
const ollamaModel = arg('model', 'llama3.2:3b');
const promptProfile = arg('promptProfile', 'champion');

if (!venture && !allowAll) {
  console.error(JSON.stringify({ ok: false, error: 'venture_required', hint: 'Pass --venture <lane> or --allowAll true' }));
  process.exit(1);
}

const qc = readJson(QC_POLICY_PATH, {});
const omni = readJson(OMNI_POLICY_PATH, {});
const defaultPolicy = readJson(join(REVIEW_POLICY_DIR, 'default.json'), {});
const venturePolicy = venture ? readJson(join(REVIEW_POLICY_DIR, `${venture.toLowerCase()}.json`), {}) : {};

const weights = {
  marketFit: Number(venturePolicy?.weights?.marketFit ?? defaultPolicy?.weights?.marketFit ?? 0.3),
  clarity: Number(venturePolicy?.weights?.clarity ?? defaultPolicy?.weights?.clarity ?? 0.2),
  compliance: Number(venturePolicy?.weights?.compliance ?? defaultPolicy?.weights?.compliance ?? 0.25),
  hookStrength: Number(venturePolicy?.weights?.hookStrength ?? defaultPolicy?.weights?.hookStrength ?? 0.15),
  ctaStrength: Number(venturePolicy?.weights?.ctaStrength ?? defaultPolicy?.weights?.ctaStrength ?? 0.1),
};

const policyMinScore = Number(venturePolicy?.minScore ?? defaultPolicy?.minScore ?? 75);
const confidenceEscalate = Number(venturePolicy?.confidenceEscalate ?? defaultPolicy?.confidenceEscalate ?? 0.7);

const BOARD_PATH = join(ROOT, 'state', 'content-review-board.md');
const WORKSPACE_BOARD_PATH = join(WORKSPACE, 'POSTS_REVIEW_BOARD.md');
const scoped = (venture || 'all').toLowerCase();
const VENTURE_BOARD_PATH = join(ROOT, 'state', `content-review-board-${scoped}.md`);
const WORKSPACE_VENTURE_BOARD_PATH = join(WORKSPACE, `POSTS_REVIEW_BOARD_${scoped.toUpperCase()}.md`);

const db = new DatabaseSync(DB_PATH);

const where = [`r.platform = ?`, `r.status = 'draft'`];
const params = [platform];
if (venture) {
  where.push(`i.venture = ?`);
  params.push(venture);
}
const sql = `SELECT r.id AS render_id, r.item_id, r.platform, r.text_rendered, r.created_at, i.venture, i.content_type, i.cta
             FROM content_renders r
             JOIN content_items i ON i.id = r.item_id
             WHERE ${where.join(' AND ')}
             ORDER BY r.created_at DESC
             LIMIT ?`;
params.push(limit);
const rows = db.prepare(sql).all(...params);

if (!rows.length) {
  console.log(JSON.stringify({ ok: true, reviewed: 0, reason: 'no_draft_renders', platform, venture: venture || 'all' }));
  process.exit(0);
}

const updateStatus = db.prepare(`UPDATE content_renders SET status=? WHERE id=?`);

const hardBlocks = [
  ...(qc.hardBlocks || []),
  ...((omni.guardrails && omni.guardrails.hardBlocks) || []),
  ...((venturePolicy && venturePolicy.bannedPhrasesExtra) || []),
].map((x) => String(x).toLowerCase());

const bannedPhrases = [
  ...((((omni.global || {}).qualityFloor || {}).bannedPhrases || []).map((x) => String(x).toLowerCase())),
  ...(((venturePolicy && venturePolicy.bannedPhrasesExtra) || []).map((x) => String(x).toLowerCase())),
];

const defaultKeywords = (((omni.global || {}).qualityFloor || {}).requiresAnyKeyword || []).map((x) => String(x).toLowerCase());
const ventureKeywords = ((venturePolicy && venturePolicy.requiredKeywords) || []).map((x) => String(x).toLowerCase());
const requiredKeywords = ventureKeywords.length ? ventureKeywords : defaultKeywords;

const maxChars = Number((qc.rules || {}).maxChars || (((omni.channels || {})[platform] || {}).maxChars || 260));
const maxHashtags = Number((qc.rules || {}).maxHashtags || (omni.global || {}).maxHashtagsDefault || 2);

function deterministicReview(text) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const hashtags = (t.match(/#\w+/g) || []).length;
  const violations = [];

  for (const hb of hardBlocks) if (hb && lower.includes(hb)) violations.push(`hard_block:${hb}`);
  for (const bp of bannedPhrases) if (bp && lower.includes(bp)) violations.push(`banned_phrase:${bp}`);
  if (t.length > maxChars) violations.push(`max_chars_exceeded:${t.length}>${maxChars}`);
  if (hashtags > maxHashtags) violations.push(`max_hashtags_exceeded:${hashtags}>${maxHashtags}`);

  const keywordHit = requiredKeywords.length === 0 || requiredKeywords.some((k) => lower.includes(k));
  if (!keywordHit) violations.push('missing_required_keyword_family');

  if (violations.some((v) => v.startsWith('hard_block'))) {
    return { gate: 'hard_fail', scorePenalty: 80, violations };
  }
  if (violations.length) {
    return { gate: 'soft_fail', scorePenalty: Math.min(45, 8 * violations.length), violations };
  }
  return { gate: 'pass', scorePenalty: 0, violations: [] };
}

async function ollamaReview(text, context) {
  const styleHint = promptProfile === 'challenger'
    ? 'Bias toward bolder hooks and sharper CTA while keeping compliance strict.'
    : 'Bias toward conservative compliance-safe quality.';
  const prompt = `You are a strict content reviewer for social posts. ${styleHint} Return ONLY valid JSON with keys: confidence (0-1 float), marketFit (0-100), clarity (0-100), compliance (0-100), hookStrength (0-100), ctaStrength (0-100), verdict (approve|rewrite|reject), reasons (string[]), rewrite (string), failureTaxonomy (string[]), rewriteStrategy (string), implementationSteps (string[]), expectedOutcome (string). Context: ${JSON.stringify(context)} Draft: ${text}`;
  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false, format: 'json' }),
    });
    if (!res.ok) throw new Error(`ollama_http_${res.status}`);
    const data = await res.json();
    const raw = String(data?.response || '').trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('no_json_in_ollama_response');
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    return { ok: true, parsed };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

const now = new Date().toISOString();
const decisions = [];

for (const row of rows) {
  const text = String(row.text_rendered || '').trim();
  const det = deterministicReview(text);

  let llm = {
    confidence: 0.5,
    marketFit: 55,
    clarity: 60,
    compliance: det.gate === 'hard_fail' ? 10 : 60,
    hookStrength: 50,
    ctaStrength: 50,
    verdict: det.gate === 'hard_fail' ? 'reject' : (det.gate === 'soft_fail' ? 'rewrite' : 'approve'),
    reasons: ['fallback_heuristic'],
    rewrite: '',
    failureTaxonomy: [],
    rewriteStrategy: '',
    implementationSteps: [],
    expectedOutcome: '',
  };

  const context = {
    platform,
    venture: row.venture,
    contentType: row.content_type,
    cta: row.cta || '',
    policy: {
      minScore: policyMinScore,
      weights,
      maxChars,
      maxHashtags,
      requiredKeywordFamily: requiredKeywords,
    },
  };

  const llmRes = await ollamaReview(text, context);
  if (llmRes.ok && llmRes.parsed) llm = { ...llm, ...llmRes.parsed };
  else llm.reasons = [...llm.reasons, `ollama_error:${llmRes.error}`];

  const weighted =
    Number(llm.marketFit || 0) * weights.marketFit +
    Number(llm.clarity || 0) * weights.clarity +
    Number(llm.compliance || 0) * weights.compliance +
    Number(llm.hookStrength || 0) * weights.hookStrength +
    Number(llm.ctaStrength || 0) * weights.ctaStrength;

  const normalizedScore = clamp(Math.round(weighted - det.scorePenalty), 0, 100);
  const confidence = clamp(Number(llm.confidence || 0.5), 0, 1);

  let decision = 'rewrite';
  if (det.gate === 'hard_fail') decision = 'reject';
  else if (normalizedScore >= policyMinScore && confidence >= confidenceEscalate && String(llm.verdict) !== 'reject') decision = 'approve';
  else if (String(llm.verdict) === 'reject') decision = 'reject';

  const status = decision === 'approve' ? 'approved' : (decision === 'reject' ? 'rejected' : 'rewrite_needed');

  const record = {
    ts: now,
    reviewId: uid('crv'),
    renderId: row.render_id,
    itemId: row.item_id,
    venture: row.venture,
    platform: row.platform,
    decision,
    status,
    score: normalizedScore,
    confidence,
    thresholds: { minScore: policyMinScore, confidenceEscalate },
    weights,
    evidence: {
      deterministic: det,
      llm: {
        marketFit: Number(llm.marketFit || 0),
        clarity: Number(llm.clarity || 0),
        compliance: Number(llm.compliance || 0),
        hookStrength: Number(llm.hookStrength || 0),
        ctaStrength: Number(llm.ctaStrength || 0),
        reasons: Array.isArray(llm.reasons) ? llm.reasons.slice(0, 8) : [String(llm.reasons || '')],
      },
    },
    rewrite: String(llm.rewrite || '').trim(),
    failureTaxonomy: Array.isArray(llm.failureTaxonomy) ? llm.failureTaxonomy.slice(0, 8) : [],
    rewriteStrategy: String(llm.rewriteStrategy || '').trim(),
    implementationSteps: Array.isArray(llm.implementationSteps) ? llm.implementationSteps.slice(0, 6) : [],
    expectedOutcome: String(llm.expectedOutcome || '').trim(),
    promptProfile,
    preview: clip(text, 220),
  };

  if (!dryRun) updateStatus.run(status, row.render_id);
  decisions.push(record);
}

mkdirSync(dirname(DECISIONS_PATH), { recursive: true });
appendFileSync(DECISIONS_PATH, decisions.map((d) => JSON.stringify(d)).join('\n') + '\n');
if (!readJson(FEEDBACK_PATH, null)) writeFileSync(FEEDBACK_PATH, '');

const latest = decisions.slice(-30).reverse();
const lines = [];
lines.push('# Content Review Board');
lines.push('');
lines.push(`Updated: ${new Date().toISOString()}`);
lines.push(`Platform: ${platform} | Venture: ${venture || 'all'} | Reviewed: ${decisions.length}`);
lines.push(`Policy: minScore=${policyMinScore}, confidenceEscalate=${confidenceEscalate}`);
lines.push('');
for (const d of latest) {
  lines.push(`## ${d.decision.toUpperCase()} | score=${d.score} | conf=${d.confidence.toFixed(2)} | ${d.venture}`);
  lines.push(`- Preview: ${d.preview}`);
  lines.push(`- Reasons: ${(d.evidence.llm.reasons || []).join('; ') || 'n/a'}`);
  if ((d.failureTaxonomy || []).length) lines.push(`- Failure tags: ${(d.failureTaxonomy || []).join(', ')}`);
  if (d.rewriteStrategy) lines.push(`- Strategy: ${clip(d.rewriteStrategy, 220)}`);
  if (d.rewrite) lines.push(`- Rewrite: ${clip(d.rewrite, 260)}`);
  lines.push('');
}

writeFileSync(BOARD_PATH, lines.join('\n'));
writeFileSync(WORKSPACE_BOARD_PATH, lines.join('\n'));
writeFileSync(VENTURE_BOARD_PATH, lines.join('\n'));
writeFileSync(WORKSPACE_VENTURE_BOARD_PATH, lines.join('\n'));

const allHistory = readJsonl(DECISIONS_PATH).filter((d) => !venture || String(d?.venture || '').toLowerCase() === venture.toLowerCase());
const window = allHistory.slice(-200);
const avg = (arr, key) => (arr.length ? arr.reduce((s, x) => s + Number(x?.[key] || 0), 0) / arr.length : 0);
const firstHalf = window.slice(0, Math.floor(window.length / 2));
const secondHalf = window.slice(Math.floor(window.length / 2));
const drift = {
  ts: now,
  venture: venture || 'all',
  platform,
  sample: window.length,
  approveRate: window.length ? window.filter((x) => x.decision === 'approve').length / window.length : 0,
  rewriteRate: window.length ? window.filter((x) => x.decision === 'rewrite').length / window.length : 0,
  rejectRate: window.length ? window.filter((x) => x.decision === 'reject').length / window.length : 0,
  avgScore: avg(window, 'score'),
  avgConfidence: avg(window, 'confidence'),
  driftVsFirstHalf: {
    scoreDelta: avg(secondHalf, 'score') - avg(firstHalf, 'score'),
    confidenceDelta: avg(secondHalf, 'confidence') - avg(firstHalf, 'confidence'),
  },
};

mkdirSync(DRIFT_DIR, { recursive: true });
const driftPath = join(DRIFT_DIR, `${scoped}.json`);
writeFileSync(driftPath, JSON.stringify(drift, null, 2));

const summary = decisions.reduce((acc, d) => {
  acc[d.decision] = (acc[d.decision] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  ok: true,
  reviewed: decisions.length,
  summary,
  platform,
  venture: venture || 'all',
  policy: { minScore: policyMinScore, confidenceEscalate, weights },
  decisionsPath: DECISIONS_PATH,
  boardPath: VENTURE_BOARD_PATH,
  driftPath,
  dryRun,
}, null, 2));
