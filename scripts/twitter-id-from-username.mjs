#!/usr/bin/env node

const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
const username = (process.env.X_USERNAME || process.argv[2] || "").replace(/^@/, "").trim();

if (!token) {
  console.error("missing_x_bearer_token");
  process.exit(1);
}
if (!username) {
  console.error("usage: npm run -s twitter:id -- <username>  (or set X_USERNAME)");
  process.exit(1);
}

const res = await fetch(`https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}`, {
  headers: { authorization: `Bearer ${token}` }
});

if (!res.ok) {
  const txt = await res.text().catch(() => "");
  console.error(`twitter_id_lookup_failed_${res.status}: ${txt}`);
  process.exit(1);
}

const body = await res.json();
const id = body?.data?.id;
if (!id) {
  console.error("twitter_id_lookup_no_id");
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, username: body?.data?.username, id, name: body?.data?.name }, null, 2));
console.log(`\nSet this in mission-control/.env.local:\nX_ALLOWED_USER_ID=${id}`);
