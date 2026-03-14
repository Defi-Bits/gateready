#!/usr/bin/env node

export async function verifyTwitterIdentity() {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  const allowedUserId = (process.env.X_ALLOWED_USER_ID || "").trim();
  const strict = String(process.env.X_IDENTITY_STRICT || "true").toLowerCase() === "true";

  if (!token) throw new Error("missing_x_bearer_token");
  if (!allowedUserId) return { ok: true, skipped: true, reason: "no_allowed_user_id_set" };

  const res = await fetch("https://api.twitter.com/2/users/me", {
    headers: { authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    if (strict) throw new Error(`twitter_identity_check_failed_${res.status}`);
    return { ok: false, skipped: true, reason: `identity_check_http_${res.status}` };
  }

  const body = await res.json();
  const actual = String(body?.data?.id || "");
  if (!actual) {
    if (strict) throw new Error("twitter_identity_check_no_user");
    return { ok: false, skipped: true, reason: "identity_check_no_user" };
  }

  if (actual !== allowedUserId) {
    throw new Error(`twitter_identity_mismatch_expected_${allowedUserId}_got_${actual}`);
  }

  return { ok: true, skipped: false, userId: actual };
}
