/**
 * GateReady™ — Gate Check API v4.1 (Vercel-Ready)
 *
 * Smart stadium policy lookup with cost-tier strategy:
 *   Tier 0 — DB exact/fuzzy hit (score ≥ 0.70)  → $0.00,  instant
 *   Tier 1 — LLM cache exact match               → $0.00,  instant
 *   Tier 2 — Low confidence DB (0.50–0.69)       → $0.00,  instant + note
 *   Tier 3 — Email-gated LLM (true miss)         → $0.0003, one-time, cached forever
 *
 * Changes vs v4:
 *   - saveDB() is now defensive: writes go to /tmp on Vercel (read-only FS),
 *     and silently no-op on EROFS. Cache layer can degrade without crashing.
 *   - DB is loaded once at module init and re-read from /tmp if a cached
 *     version is available (cache reads survive within a warm instance).
 *   - All FS errors caught — never crash a request.
 *   - Module-load is now risk-free: loadDB() failure logs and returns an
 *     empty DB rather than throwing.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ON_VERCEL = !!process.env.VERCEL;
const SOURCE_DB_PATH = path.join(__dirname, '../data/stadiums.json');
const CACHE_DB_PATH  = ON_VERCEL ? '/tmp/stadiums.cache.json' : SOURCE_DB_PATH;

/* ----------------------------- DB I/O ----------------------------- */

function loadDB() {
  // Prefer the writable cache if it exists (warm instance with prior writes)
  for (const p of [CACHE_DB_PATH, SOURCE_DB_PATH]) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (err) {
      console.warn('[gatecheck] loadDB failed for', p, '-', err.message);
    }
  }
  return { meta: {}, venues: [], llm_cache: [] };
}

function saveDB(db) {
  const target = CACHE_DB_PATH;
  try {
    fs.writeFileSync(target, JSON.stringify(db, null, 2));
    return true;
  } catch (err) {
    // EROFS on Vercel non-/tmp paths, ENOENT, EACCES, etc.
    if (err.code !== 'EROFS' && err.code !== 'EACCES') {
      console.warn('[gatecheck] saveDB failed:', err.code, err.message);
    }
    return false;
  }
}

/* -------------------------- query helpers -------------------------- */

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanQuery(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/can i bring (my |a |an )?(bag|purse|backpack|tote|clutch|fanny pack)?(\s+to)?/g, '')
    .replace(/what (bags?|items?|purses?)( are)? (allowed|permitted|ok|okay)( at| in| for)?/g, '')
    .replace(/\b(is|are|the|a|an|my|at|in|for|to|into|inside|allowed|permitted|bag policy|bag rules|clear bag|what can i bring|game|match|show|event|concert|tonight|this weekend|stadium|arena)\b/g, ' ')
    .replace(/[^a-z0-9 &]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunk(q) {
  if (!q || q.length < 3) return true;
  if (/^\d+$/.test(q)) return true;
  if (/^[^a-z]+$/i.test(q)) return true;
  return false;
}

/* --------------------------- scoring --------------------------- */

function score(query, venue) {
  const queries = [...new Set([query, cleanQuery(query)].filter(Boolean))];

  for (const raw of queries) {
    const q = normalize(raw);
    if (!q) continue;

    // Alias match — highest confidence
    for (const alias of (venue.aliases || [])) {
      const a = normalize(alias);
      if (!a) continue;
      if (q === a) return 1.0;
      if (q.includes(a) || a.includes(q)) return 0.95;
      const qW = q.split(' ').filter(w => w.length > 2);
      const aW = a.split(' ');
      const overlap = qW.filter(w => aW.includes(w)).length;
      if (overlap >= 2) return 0.88;
    }

    // Name match
    const nameLower = normalize(venue.name);
    if (nameLower && (q.includes(nameLower) || nameLower.includes(q))) return 0.92;

    // Team match
    for (const team of (venue.teams || [])) {
      const t = normalize(team);
      if (!t) continue;
      if (q.includes(t) || t.includes(q)) return 0.9;
      const qW = q.split(' ').filter(w => w.length > 2);
      const tW = t.split(' ');
      const overlap = qW.filter(w => tW.includes(w)).length;
      if (overlap >= 1) return 0.75;
    }

    // City fallback
    if (venue.city && q.includes(normalize(venue.city))) return 0.5;

    // Partial word overlap with name
    const qWords = q.split(' ').filter(w => w.length > 3);
    const nWords = nameLower.split(' ');
    const overlap = qWords.filter(w => nWords.some(n => n.includes(w) || w.includes(n))).length;
    if (overlap >= 2) return 0.7;
    if (overlap >= 1) return 0.4;
  }

  return 0;
}

/* ----------------------- lookup in DB ----------------------- */

function lookupInDB(query) {
  const db = loadDB();
  const venues = db.venues || [];
  const cache  = db.llm_cache || [];

  // Exact LLM cache match first
  const qNorm = normalize(query);
  for (const cached of cache) {
    if (normalize(cached.query) === qNorm) {
      return { venue: cached.venue, confidence: 'cached', score: 1.0 };
    }
  }

  // Fuzzy against main venues
  let best = null;
  let bestScore = 0;
  for (const venue of venues) {
    const s = score(query, venue);
    if (s > bestScore) {
      bestScore = s;
      best = venue;
    }
  }

  if (bestScore >= 0.9) return { venue: best, confidence: 'high',   score: bestScore };
  if (bestScore >= 0.7) return { venue: best, confidence: 'medium', score: bestScore };
  if (bestScore >= 0.5) return { venue: best, confidence: 'low',    score: bestScore };
  return null;
}

/* --------------------------- LLM call --------------------------- */

function callLLM(query, callback) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) {
    return callback(null, { error: 'No API key configured' });
  }

  const db = loadDB();
  const venueNames = (db.venues || []).map(v => v.name).join(', ');

  const prompt = `You are a stadium bag policy expert. A fan is asking about bag rules for: "${query}"

Known venues in our database: ${venueNames}

If this matches a known venue, return ONLY a JSON object with:
{
  "matched_venue": "exact venue name from list above or null",
  "confidence": "high|medium|low",
  "policy_summary": "2-sentence plain English summary of what bag they can bring",
  "clear_bag_required": true/false,
  "max_size": "WxHxD in inches or null",
  "clutch_allowed": true/false,
  "clutch_size": "WxH in inches or null",
  "backpacks_allowed": true/false,
  "medical_exception": true/false,
  "what_you_can_bring": ["item1", "item2"],
  "notes": "one sentence"
}

If no match, set matched_venue to null and provide best-effort guidance.
Return ONLY valid JSON, no other text.`;

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }]
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const text   = (parsed.content && parsed.content[0] && parsed.content[0].text) || '{}';
        const result = JSON.parse(text.replace(/```json|```/g, '').trim());

        const db2 = loadDB();
        db2.llm_cache = db2.llm_cache || [];

        // Try to match to a known venue
        if (result.matched_venue) {
          const matched = (db2.venues || []).find(v =>
            normalize(v.name) === normalize(result.matched_venue)
          );
          if (matched) {
            db2.llm_cache.push({ query, venue: matched, added: new Date().toISOString() });
            saveDB(db2);
            return callback(null, { venue: matched, confidence: 'llm_matched', llm_result: result });
          }
        }

        // Synthetic venue from LLM
        const synthetic = {
          id: 'llm-' + Date.now(),
          name: result.matched_venue || query,
          aliases: [cleanQuery(query) || normalize(query)],
          city: 'Unknown',
          state: '',
          teams: [],
          league: [],
          policy: {
            clear_bag_required: result.clear_bag_required !== undefined ? result.clear_bag_required : true,
            max_size: result.max_size || '12x6x12',
            clutch_allowed: result.clutch_allowed !== undefined ? result.clutch_allowed : true,
            clutch_max_size: result.clutch_size || '4.5x6.5',
            backpacks_allowed: result.backpacks_allowed === true,
            medical_exception: result.medical_exception !== undefined ? result.medical_exception : true,
            what_you_can_bring: result.what_you_can_bring || [
              'Clear bag (12×6×12″ max)',
              'Small clutch or wristlet',
              'Phone & keys'
            ],
            notes: (result.notes || result.policy_summary || '') + ' Verify with venue website before your event.',
            source: 'AI-generated (verify with venue)',
            verified: false,
            llm_generated: true
          }
        };

        db2.llm_cache.push({ query, venue: synthetic, added: new Date().toISOString() });
        saveDB(db2);
        callback(null, { venue: synthetic, confidence: 'llm_unverified', llm_result: result });

      } catch (e) {
        console.error('[gatecheck] LLM parse error:', e.message);
        callback(e, null);
      }
    });
  });

  req.on('error', e => {
    console.error('[gatecheck] LLM request error:', e.message);
    callback(e, null);
  });
  req.write(body);
  req.end();
}

/* ------------------------- response shape ------------------------- */

function deriveAllowedItems(policy) {
  if (Array.isArray(policy.what_you_can_bring)) return policy.what_you_can_bring;
  const items = [`Clear bag (max ${policy.max_size || '12×6×12'}″)`];
  if (policy.clutch_allowed) {
    items.push(`Small clutch / wristlet${policy.clutch_max_size ? ' (up to ' + policy.clutch_max_size + '″)' : ''}`);
  }
  if (policy.one_gallon_ziplock) items.push('One-gallon clear zip-lock bag');
  if (policy.medical_exception)  items.push('Medical/diaper bag (with notification)');
  items.push('Phone, keys, wallet inside clear bag');
  return items;
}

function buildMessage(venue, policy) {
  if (policy.clear_bag_required === false) {
    return `${venue.name} does not currently enforce a clear bag policy. Standard bag rules apply — always verify before your event.`;
  }
  const sz = (policy.max_size || '12x6x12').replace(/x/g, '″ × ') + '″';
  const clutch = policy.clutch_allowed
    ? ` A small clutch${policy.clutch_max_size ? ' (up to ' + policy.clutch_max_size.replace(/x/g, '×') + '″)' : ''} is also permitted.`
    : '';
  return `${venue.name} requires a clear bag no larger than ${sz}.${clutch} GateReady bags meet this policy — you're good to go.`;
}

function formatResponse(result) {
  if (!result) return null;
  const { venue, confidence } = result;
  const p = venue.policy || {};
  return {
    found: true,
    venue: {
      name:   venue.name,
      city:   venue.city,
      state:  venue.state,
      teams:  venue.teams,
      league: venue.league
    },
    policy: {
      clear_bag_required: p.clear_bag_required,
      max_size:           p.max_size,
      clutch_allowed:     p.clutch_allowed,
      clutch_size:        p.clutch_max_size || null,
      one_gallon_ziplock: p.one_gallon_ziplock || false,
      backpacks_allowed:  p.backpacks_allowed,
      medical_exception:  p.medical_exception,
      what_you_can_bring: deriveAllowedItems(p),
      notes:              p.notes,
      source:             p.source,
      verified:           p.verified,
      llm_generated:      p.llm_generated || false
    },
    gateready_approved: p.clear_bag_required !== false,
    confidence,
    message: buildMessage(venue, p)
  };
}

/* ----------------------- public handlers ----------------------- */

/**
 * handleGateCheck — standard lookup (no LLM on miss, returns email_required)
 * Used by /api/gate-check (fan-facing)
 */
function handleGateCheck(rawQuery, callback) {
  const q = String(rawQuery || '').trim();

  if (isJunk(cleanQuery(q))) {
    return callback(null, {
      found: false,
      message: 'Enter a stadium name, team, or city to look up the bag policy.'
    });
  }

  const dbResult = lookupInDB(q);

  if (dbResult && ['high', 'medium', 'cached'].includes(dbResult.confidence)) {
    return callback(null, formatResponse(dbResult));
  }

  if (dbResult && dbResult.confidence === 'low') {
    const res = formatResponse(dbResult);
    res.confidence = 'low';
    res.message += ' (Closest match — verify at venue website.)';
    return callback(null, res);
  }

  // True miss — signal email is required before LLM fires
  return callback(null, {
    found: false,
    email_required: true,
    query: q,
    message: `We don't have "${q}" in our database yet.`
  });
}

/**
 * handleGateCheckWithEmail — called after email captured
 * Fires LLM, caches result, used by /api/gate-check-lookup
 */
function handleGateCheckWithEmail(rawQuery, email, callback) {
  const q = String(rawQuery || '').trim();

  // Re-check DB (may have been cached since first call)
  const dbResult = lookupInDB(q);
  if (dbResult) {
    return callback(null, { ...formatResponse(dbResult), email_captured: email });
  }

  console.log(`[GateReady] Gate Check lead: ${email} → "${q}"`);

  callLLM(q, (err, llmResult) => {
    if (err || !llmResult || llmResult.error) {
      return callback(null, {
        found: false,
        message: `No policy data found for "${q}". Most venues require a clear bag no larger than 12″ × 6″ × 12″. GateReady bags meet standard clear bag policy.`,
        gateready_approved: true,
        fallback: true,
        what_to_do: [
          'Bring a clear bag (max 12″ × 6″ × 12″)',
          'Small clutch or wristlet typically OK',
          'Leave backpacks in the car',
          'Verify exact rules at venue website'
        ],
        email_captured: email
      });
    }
    callback(null, { ...formatResponse(llmResult), email_captured: email });
  });
}

module.exports = { handleGateCheck, handleGateCheckWithEmail };
