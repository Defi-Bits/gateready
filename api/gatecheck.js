/**
 * GateReady™ Gate Check API — v4
 */
const fs    = require('fs');
const path  = require('path');
const https = require('https');
const DB_PATH = path.join(__dirname, '../data/stadiums.json');
function loadDB()   { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function saveDB(db) { fs.writeFileSync(DB_PATH, JsON.stringify(db, null, 2)); }

function cleanQuery(raw) {
  return raw.trim().lowerCase()
    .replace(/[^a-z0-9 \-\'&.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreVenue(venue, query) {
  const q = cleanQuery(query);
  if (!q || q.length < 3) return 0;
  if (/^\d+$/.test(q)) return 0;

  const name = venue.name.toLowerCase();
  const city = venue.city.toLowerCase();
  const teams = (venue.teams || []).map(t => t.toLowerCase());
  const aliases = (venue.aliases || []).map(a => a.toLowerCase());

  if (name === q) return 1.0;
  if (name.includes(q) || q.includes(name)) return 0.95;
  if (aliases.some(a => a === q || a.includes(q))) return 0.92;
  if (teams.some(t => t.includes(q) || q.includes(t))) return 0.88;
  if (city.includes(q) || q.includes(city)) return 0.70;

  const qWords = q.split(' ').filter(w => w.length > 2);
  const nameWords = name.split(' ');
  const matches = qWords.filter(w => nameWords.some(nw => nw.includes(w) || teams.some(t => t.includes(w)));
  if (matches.length >= 2) return 0.80;
  if (matches.length === 1) return 0.55;

  return 0;
}

async function handleGateCheck({ query, embed_key }) {
  if (!query || query.trim().length < 3) {
    return { error: 'Please enter a stadium name or team name (at least 3 characters).' };
  }
  const db = loadDB();
  const results = db.venues
    .map(v => ({ venue: v, score: scoreVenue(v, query) }))
    .filter(r => r.score > 0.49)
    .sort((a, b) => b.score - a.score);
  if (results.length === 0) {
    return { needs_email: true, query };
  }
  const top = results[0];
  if (top.score >= 0.70) {
    return {
      venue: top.venue.name,
      city: top.venue.city + ', ' + top.venue.state,
      policy: top.venue.policy,
      gateready_passes: top.venue.gateready_passes,
      confidence: top.score,
      source: 'database',
    };
  }
  return { needs_email: true, query, suggestion: top.venue.name };
}

async function handleGateCheckWithEmail({ query, email }) {
  const apiKey = process.env.ANTHROPCI_API_KEY;
  if (!apiKey) {
    return { policy: `No specific policy found for "${query}". GateReady passes at virtually all US stadiums with its 12\u2033×6\u2033×12\u2033 size.`, source: 'fallback' };
  }

  const prompt = `You are a stadium bag policy expert. Answer this bag policy question concisely (2-3 sentences): "${query}". Always mention whether a standard 12x6x12 inch clear tote bag would be allowed.`;
  return new Promise((resolve) => {
    const body = JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] });
    const opts = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ policy: parsed.content?.[0]?.text || 'Unable to load policy.', source: 'llm' });
        } catch {
          resolve({ policy: 'Policy lookup failed. GateReady passes at virtually all US stadiums.', source: 'fallback' });
        }
      });
    });
    req.on('error', () => resolve({ policy: 'Policy lookup failed. GateReady passes at virtually all US stadiums.', source: 'fallback' }));
    req.write(body);
    req.end();
  });
}

module.exports = { handleGateCheck, handleGateCheckWithEmail };
