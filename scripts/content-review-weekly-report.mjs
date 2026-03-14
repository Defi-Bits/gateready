#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/terminal/.openclaw/workspace/mission-control';
const DECISIONS = join(ROOT, 'state', 'content-review-decisions.jsonl');
const OUT_DIR = join(ROOT, 'state', 'content-review-reports');
const WORKSPACE_OUT_DIR = '/Users/terminal/.openclaw/workspace/reports';

function arg(name, fallback='') { const i = process.argv.indexOf(`--${name}`); return i===-1?fallback:(process.argv[i+1]??fallback); }
function readJsonl(path){ try{return readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];} }
function avg(arr, key){ return arr.length ? arr.reduce((s,x)=>s+Number(x?.[key]||0),0)/arr.length : 0; }

const venture = arg('venture','');
const days = Number(arg('days','7'));
const now = Date.now();
const cutoff = now - (days*24*60*60*1000);

const all = readJsonl(DECISIONS).filter(d => {
  const t = Date.parse(String(d?.ts||''));
  if (!Number.isFinite(t) || t < cutoff) return false;
  if (venture && String(d?.venture||'').toLowerCase() !== venture.toLowerCase()) return false;
  return true;
});

const groups = new Map();
for (const d of all){
  const v = String(d?.venture || 'unknown');
  if (!groups.has(v)) groups.set(v, []);
  groups.get(v).push(d);
}

const report = {
  ts: new Date().toISOString(),
  windowDays: days,
  venture: venture || 'all',
  ventures: [],
};

for (const [v, arr] of groups.entries()){
  const approve = arr.filter(x=>x.decision==='approve').length;
  const rewrite = arr.filter(x=>x.decision==='rewrite').length;
  const reject = arr.filter(x=>x.decision==='reject').length;
  const topFailures = {};
  for (const a of arr){
    for (const f of (a?.failureTaxonomy || [])) topFailures[f] = (topFailures[f]||0)+1;
  }
  const top = Object.entries(topFailures).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,c])=>({tag:k,count:c}));
  report.ventures.push({
    venture: v,
    sample: arr.length,
    approveRate: arr.length?approve/arr.length:0,
    rewriteRate: arr.length?rewrite/arr.length:0,
    rejectRate: arr.length?reject/arr.length:0,
    avgScore: avg(arr,'score'),
    avgConfidence: avg(arr,'confidence'),
    topFailureTags: top,
    recommendations: [
      'Increase variant testing on top 3 themes.',
      'Review top failure tags and patch rubric/prompt.',
      'Promote challenger only if approval quality and confidence improve together.'
    ]
  });
}

mkdirSync(OUT_DIR,{recursive:true});
mkdirSync(WORKSPACE_OUT_DIR,{recursive:true});
const scope = (venture||'all').toLowerCase();
const outJson = join(OUT_DIR, `weekly-${scope}.json`);
const outMd = join(WORKSPACE_OUT_DIR, `CONTENT_REVIEW_WEEKLY_${scope.toUpperCase()}.md`);
writeFileSync(outJson, JSON.stringify(report,null,2));

const md = [
  `# Content Review Weekly Report (${scope})`,
  `Generated: ${report.ts}`,
  `Window: ${days} days`,
  ''
];
for (const v of report.ventures){
  md.push(`## ${v.venture}`);
  md.push(`- Sample: ${v.sample}`);
  md.push(`- Approve: ${(v.approveRate*100).toFixed(1)}% | Rewrite: ${(v.rewriteRate*100).toFixed(1)}% | Reject: ${(v.rejectRate*100).toFixed(1)}%`);
  md.push(`- Avg Score: ${v.avgScore.toFixed(1)} | Avg Confidence: ${v.avgConfidence.toFixed(2)}`);
  md.push(`- Top Failure Tags: ${v.topFailureTags.map(t=>`${t.tag}(${t.count})`).join(', ') || 'none'}`);
  md.push('');
}
writeFileSync(outMd, md.join('\n'));

console.log(JSON.stringify({ok:true, venture: scope, sample: all.length, outJson, outMd}, null, 2));
