/**
 * GateReady™ — Express Server v8.2 (Vercel-Ready, Hardened)
 * Full site + admin backend + Gate.AI proxy
 *
 * Changes vs v8.1:
 *  - Promisified callback-style gatecheck handlers
 *    (handleGateCheck(query, cb) → callGateCheck(query) returning Promise)
 *  - Extract query string from req.body.query (was passing whole body object)
 *  - Pass email through to handleGateCheckWithEmail correctly
 *
 * Changes vs original v8:
 *  - Fixed three syntax errors (=>>{, s+,o.total, missing quote)
 *  - Fixed ANTHROPCI_API_KEY → ANTHROPIC_API_KEY typo
 *  - Defensive require of ./api/gatecheck — module load failures no longer
 *    crash the whole app; the two GateCheck routes return clean 503s instead
 *  - Top-level error handler (returns JSON, never crashes)
 *  - Page-view counters use a helper with ||0 guard (no more NaN)
 *  - Removed duplicate module.exports
 *  - Skip app.listen() under Vercel (process.env.VERCEL is set there)
 *  - /api/health for at-a-glance env-var + module-load diagnostics
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------------------ helpers ------------------------------ */

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k.trim()] = v.join('=');
  });
  return out;
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error('safeRead failed for', filePath, '-', err.message);
    return null;
  }
}

function renderPage(pageName, vars = {}) {
  const layout =
    safeRead(path.join(__dirname, 'views/layout.html')) || '{{CONTENT}}';
  const page =
    safeRead(path.join(__dirname, 'views/pages', pageName)) ||
    `<h1>Page not found: ${pageName}</h1>`;
  let html = layout.replace('{{CONTENT}}', page);
  Object.entries(vars).forEach(([k, v]) => {
    html = html.split(`{{${k}}}`).join(v);
  });
  html = html.replace(/\{\{[A-Z_]+\}\}/g, '');
  return html;
}

function bumpView(p) {
  if (!analytics.page_views[p]) analytics.page_views[p] = 0;
  analytics.page_views[p] += 1;
}

function hashPass(p) {
  return crypto.createHash('sha256').update(String(p || '')).digest('hex');
}

/* ------------------------------ auth ------------------------------ */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@begateready.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GateReady2026!';
const adminSessions = new Map();
const sessions = new Map();

function createAdminSession() {
  const t = crypto.randomBytes(32).toString('hex');
  adminSessions.set(t, { created: Date.now() });
  return t;
}

function isAdminLoggedIn(req) {
  const c = parseCookies(req);
  if (!c.gr_admin) return false;
  const s = adminSessions.get(c.gr_admin);
  if (!s || Date.now() - s.created > 8 * 3600 * 1000) {
    adminSessions.delete(c.gr_admin);
    return false;
  }
  return true;
}

function createVendorSession(email) {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, { email, created: Date.now() });
  return t;
}

function getVendorSession(req) {
  const c = parseCookies(req);
  if (!c.gr_session) return null;
  const s = sessions.get(c.gr_session);
  if (!s || Date.now() - s.created > 7 * 86400 * 1000) {
    sessions.delete(c.gr_session);
    return null;
  }
  return s;
}

function isVendorLoggedIn(req) {
  const s = getVendorSession(req);
  if (!s) return false;
  const v = vendorAccounts.get(s.email);
  return !!(v && v.approved);
}

function requireAdmin(req, res, next) {
  if (!isAdminLoggedIn(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/* ------------------------------ data ------------------------------ */

const TIERS = [
  { qty: 10, label: 'Starter', per: 16, total: 160 },
  { qty: 50, label: 'Most Popular', per: 13, total: 650 },
  { qty: 100, label: 'Vendor Standard', per: 11, total: 1100 },
  { qty: 250, label: 'High Volume', per: 10, total: 2500 },
  { qty: 500, label: 'Distributor', per: 9, total: null },
];

const vendorAccounts = new Map([
  ['demo@vendor.com', {
    id: 'v_001',
    email: 'demo@vendor.com',
    password_hash: hashPass('demo123'),
    name: 'Marcus Johnson',
    business: 'Stadium Snacks LLC',
    phone: '404-555-0100',
    city: 'Atlanta, GA',
    type: 'Concession Stand',
    tier: 50,
    approved: true,
    active: true,
    created: Date.now() - 45 * 86400000,
    last_login: Date.now() - 2 * 86400000,
    embed_key: 'gr_emb_demo0001',
    embed_plan: '$99/mo',
    notes: 'Demo vendor',
  }],
  ['gate@go.com', {
    id: 'v_002',
    email: 'gate@go.com',
    password_hash: hashPass('gatepass'),
    name: 'Deja Williams',
    business: 'Gate & Go ATL',
    phone: '404-555-0222',
    city: 'Atlanta, GA',
    type: 'Stadium Vendor',
    tier: 100,
    approved: true,
    active: true,
    created: Date.now() - 30 * 86400000,
    last_login: Date.now() - 5 * 86400000,
    embed_key: 'gr_emb_gate0002',
    embed_plan: '$49/mo',
    notes: '',
  }],
]);

const applications = new Map();

const orders = new Map([
  ['ord_001', {
    id: 'ord_001', vendor: 'demo@vendor.com', qty: 50, per: 13,
    total: 650, status: 'Shipped', date: Date.now() - 10 * 86400000,
  }],
  ['ord_002', {
    id: 'ord_002', vendor: 'gate@go.com', qty: 100, per: 11,
    total: 1100, status: 'Delivered', date: Date.now() - 22 * 86400000,
  }],
]);

const analytics = {
  gate_check_hits: 0,
  gate_check_misses: 0,
  gate_check_llm_calls: 0,
  llm_cost_usd: 0,
  email_captures: 0,
  page_views: {},
};

const emailCaptures = [];
const gateCheckLog = [];
const gateAIRateMap = new Map();

function checkGateAIRate(ip) {
  const now = Date.now();
  const e = gateAIRateMap.get(ip) || { count: 0, reset: now + 60000 };
  if (now > e.reset) {
    e.count = 0;
    e.reset = now + 60000;
  }
  e.count += 1;
  gateAIRateMap.set(ip, e);
  return e.count <= 10;
}

/* --------------------- gatecheck (defensive + promisified) --------------------- */

let gatecheckMod = null;
let gatecheckLoadError = null;
try {
  gatecheckMod = require('./lib/gatecheck');
} catch (err) {
  gatecheckLoadError = (err && err.message) ? err.message : String(err);
  console.error('gatecheck module failed to load:', gatecheckLoadError);
}

// Promisify the callback-style exports. handleGateCheck signature is
// (query: string, callback: (err, result) => void) — server.js v8 was
// incorrectly passing req.body (an object) and no callback.
function callGateCheck(query) {
  return new Promise((resolve) => {
    if (!gatecheckMod || typeof gatecheckMod.handleGateCheck !== 'function') {
      return resolve({
        error: 'GateCheck module unavailable',
        detail: gatecheckLoadError,
      });
    }
    try {
      gatecheckMod.handleGateCheck(query, (err, result) => {
        if (err) {
          console.error('handleGateCheck callback error:', err);
          return resolve({ error: 'GateCheck failed', detail: err.message });
        }
        resolve(result);
      });
    } catch (err) {
      console.error('handleGateCheck threw synchronously:', err);
      resolve({ error: 'GateCheck threw', detail: err.message });
    }
  });
}

function callGateCheckWithEmail(query, email) {
  return new Promise((resolve) => {
    if (!gatecheckMod || typeof gatecheckMod.handleGateCheckWithEmail !== 'function') {
      return resolve({
        error: 'GateCheck module unavailable',
        detail: gatecheckLoadError,
      });
    }
    try {
      gatecheckMod.handleGateCheckWithEmail(query, email, (err, result) => {
        if (err) {
          console.error('handleGateCheckWithEmail callback error:', err);
          return resolve({ error: 'GateCheck failed', detail: err.message });
        }
        resolve(result);
      });
    } catch (err) {
      console.error('handleGateCheckWithEmail threw synchronously:', err);
      resolve({ error: 'GateCheck threw', detail: err.message });
    }
  });
}

/* ------------------------------ pages ------------------------------ */

app.get('/', (req, res) => {
  bumpView('/');
  res.send(renderPage('home.html'));
});

app.get('/shop', (req, res) => {
  bumpView('/shop');
  res.send(renderPage('shop.html'));
});

app.get('/game-day-guide', (req, res) =>
  res.send(renderPage('guide.html')));

app.get('/about', (req, res) =>
  res.send(renderPage('about.html')));

app.get('/embed', (req, res) =>
  res.send(renderPage('embed.html')));

app.get('/gate-check', (req, res) => {
  bumpView('/gate-check');
  res.send(renderPage('gatecheck.html'));
});

app.get('/world-cup', (req, res) => {
  bumpView('/world-cup');
  res.send(renderPage('worldcup.html'));
});

app.get('/wholesale', (req, res) => {
  bumpView('/wholesale');
  if (isVendorLoggedIn(req)) {
    const s = getVendorSession(req);
    const v = vendorAccounts.get(s.email);
    return res.send(renderPage('wholesale-auth.html', {
      VENDOR_NAME: v.name,
      VENDOR_BUSINESS: v.business,
      TIERS_JSON: JSON.stringify(TIERS),
    }));
  }
  res.send(renderPage('wholesale-public.html', {
    TIERS_JSON: JSON.stringify(TIERS),
  }));
});

app.get('/vendor-portal', (req, res) => {
  if (isVendorLoggedIn(req)) {
    const s = getVendorSession(req);
    const v = vendorAccounts.get(s.email);
    const vOrders = [...orders.values()].filter((o) => o.vendor === s.email);
    return res.send(renderPage('vendor-dashboard.html', {
      VENDOR_JSON: JSON.stringify(v),
      ORDERS_JSON: JSON.stringify(vOrders),
    }));
  }
  res.send(renderPage('vendor.html'));
});

app.get('/admin', (req, res) => {
  if (isAdminLoggedIn(req)) return res.redirect('/admin/dashboard');
  res.send(renderPage('admin.html'));
});

app.get('/admin/dashboard', (req, res) => {
  if (!isAdminLoggedIn(req)) return res.redirect('/admin');
  const allVendors = [...vendorAccounts.values()];
  const allOrders = [...orders.values()];
  const allApps = [...applications.values()];
  res.send(renderPage('admin-dashboard.html', {
    VENDORS_JSON: JSON.stringify(allVendors),
    ORDERS_JSON: JSON.stringify(allOrders),
    APPS_JSON: JSON.stringify(allApps),
    ANALYTICS_JSON: JSON.stringify(analytics),
    EMAILS_JSON: JSON.stringify(emailCaptures),
    GC_LOG_JSON: JSON.stringify(gateCheckLog.slice(-100)),
  }));
});

/* ------------------------------ Gate.AI ------------------------------ */

app.post('/api/gate-check', async (req, res) => {
  try {
    analytics.gate_check_hits += 1;
    const query = (req.body && req.body.query) || '';
    const result = await callGateCheck(query);
    res.json(result);
  } catch (e) {
    console.error('/api/gate-check error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/gate-check-lookup', async (req, res) => {
  try {
    analytics.gate_check_llm_calls += 1;
    analytics.llm_cost_usd += 0.0003;
    const body  = req.body || {};
    const query = body.query || '';
    const email = body.email || '';
    if (email) {
      analytics.email_captures += 1;
      emailCaptures.push({ email, query, ts: Date.now() });
    }
    const result = await callGateCheckWithEmail(query, email);
    gateCheckLog.push({
      query,
      result: result && result.policy,
      ts: Date.now(),
    });
    res.json(result);
  } catch (e) {
    console.error('/api/gate-check-lookup error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/gateai', (req, res) => {
  const ip =
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    'unknown';
  if (!checkGateAIRate(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded.' });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured.' });
  }
  const { messages, system } = req.body || {};
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system,
    messages,
  });
  const opts = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  };
  const pr = https.request(opts, (prRes) => {
    let data = '';
    prRes.on('data', (c) => { data += c; });
    prRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.status(500).json({ error: 'Upstream parse error' });
      }
    });
  });
  pr.on('error', (e) => res.status(502).json({ error: e.message }));
  pr.write(body);
  pr.end();
});

/* ------------------------------ vendor ------------------------------ */

app.post('/api/vendor/login', (req, res) => {
  const { email, password } = req.body || {};
  const vendor = vendorAccounts.get(email);
  if (!vendor || vendor.password_hash !== hashPass(password)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  if (!vendor.approved) {
    return res.status(403).json({ error: 'Account pending approval.' });
  }
  vendor.last_login = Date.now();
  const token = createVendorSession(email);
  res.setHeader(
    'Set-Cookie',
    `gr_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
  );
  res.json({ ok: true });
});

app.get('/api/vendor/logout', (req, res) => {
  const c = parseCookies(req);
  if (c.gr_session) sessions.delete(c.gr_session);
  res.setHeader('Set-Cookie', 'gr_session=; Path=/; Max-Age=0');
  res.redirect('/vendor-portal');
});

app.post('/api/vendor/apply', (req, res) => {
  const id = `app_${Date.now()}`;
  applications.set(id, {
    id,
    ...(req.body || {}),
    status: 'Pending',
    created: Date.now(),
  });
  res.json({ ok: true, id });
});

/* ------------------------------ admin ------------------------------ */

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }
  const token = createAdminSession();
  res.setHeader(
    'Set-Cookie',
    `gr_admin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`
  );
  res.json({ ok: true });
});

app.get('/api/admin/logout', (req, res) => {
  const c = parseCookies(req);
  if (c.gr_admin) adminSessions.delete(c.gr_admin);
  res.setHeader('Set-Cookie', 'gr_admin=; Path=/; Max-Age=0');
  res.redirect('/admin');
});

app.get('/api/admin/analytics', requireAdmin, (req, res) => {
  const allOrders = [...orders.values()];
  res.json({
    ...analytics,
    total_vendors: vendorAccounts.size,
    total_orders: orders.size,
    pending_applications: [...applications.values()]
      .filter((a) => a.status === 'Pending').length,
    total_revenue: allOrders.reduce((s, o) => s + (o.total || 0), 0),
    email_list_size: emailCaptures.length,
  });
});

app.get('/api/admin/vendors', requireAdmin, (req, res) => {
  res.json([...vendorAccounts.values()].map((v) => ({
    ...v,
    password_hash: undefined,
  })));
});

app.get('/api/admin/orders', requireAdmin, (req, res) =>
  res.json([...orders.values()]));

app.get('/api/admin/applications', requireAdmin, (req, res) =>
  res.json([...applications.values()]));

app.get('/api/admin/sales/summary', requireAdmin, (req, res) => {
  const all = [...orders.values()];
  const byV = {};
  all.forEach((o) => {
    byV[o.vendor] = (byV[o.vendor] || 0) + (o.total || 0);
  });
  res.json({
    total_revenue: all.reduce((s, o) => s + (o.total || 0), 0),
    total_orders: all.length,
    by_vendor: byV,
  });
});

app.get('/api/admin/emails', requireAdmin, (req, res) =>
  res.json(emailCaptures));

app.get('/api/admin/gc-log', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const start = (page - 1) * limit;
  res.json({
    total: gateCheckLog.length,
    page,
    items: gateCheckLog.slice(start, start + limit),
  });
});

/* ----------------------------- health ----------------------------- */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: 'v8.2',
    gatecheck_loaded: !!gatecheckMod,
    gatecheck_load_error: gatecheckLoadError,
    has_anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    has_admin_password: !!process.env.ADMIN_PASSWORD,
    on_vercel: !!process.env.VERCEL,
    uptime_s: Math.floor(process.uptime()),
  });
});

/* ------------------------------ tail ------------------------------ */

app.use((req, res) =>
  res.status(404).send(renderPage('home.html')));

app.use((err, req, res, next) => {
  console.error(
    'Unhandled error:',
    err && err.stack ? err.stack : err
  );
  if (res.headersSent) return next(err);
  res.status(500).json({
    error: 'Internal server error',
    message: err && err.message,
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () =>
    console.log(`GateReady running — http://localhost:${PORT}`));
}

module.exports = app;
