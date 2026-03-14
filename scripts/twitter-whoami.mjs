#!/usr/bin/env node

const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
if (!token) {
  console.error("missing_x_bearer_token");
  process.exit(1);
}

const res = await fetch("https://api.twitter.com/2/users/me", {
  headers: { authorization: `Bearer ${token}` }
});

if (!res.ok) {
  const txt = await res.text().catch(() => "");
  console.error(`twitter_whoami_failed_${res.status}: ${txt}`);
  process.exit(1);
}

const body = await res.json();
const id = body?.data?.id;
const username = body?.data?.username;
const name = body?.data?.name;

if (!id) {
  console.error("twitter_whoami_no_id");
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, id, username, name }, null, 2));
console.log(`\nSet this in mission-control/.env.local:\nX_ALLOWED_USER_ID=${id}`);
