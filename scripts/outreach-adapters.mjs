#!/usr/bin/env node

export async function postTwitter({ text, replyToTweetId = "" }) {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
  if (!token) throw new Error("missing_x_bearer_token");

  const payload = { text };
  if (replyToTweetId) payload.reply = { in_reply_to_tweet_id: replyToTweetId };

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await safeJson(res);
  if (!res.ok) throw new Error(`twitter_post_failed_${res.status}:${JSON.stringify(body)}`);
  return { id: body?.data?.id ?? null, raw: body };
}

export async function postReddit({ title, text, subreddit }) {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const refreshToken = process.env.REDDIT_REFRESH_TOKEN;
  const userAgent = process.env.REDDIT_USER_AGENT || "mission-control/1.0";

  if (!clientId || !clientSecret || !refreshToken) throw new Error("missing_reddit_credentials");

  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": userAgent,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const tokenBody = await safeJson(tokenRes);
  if (!tokenRes.ok || !tokenBody?.access_token) {
    throw new Error(`reddit_token_failed_${tokenRes.status}:${JSON.stringify(tokenBody)}`);
  }

  const submitRes = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenBody.access_token}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": userAgent,
    },
    body: new URLSearchParams({
      api_type: "json",
      kind: "self",
      sr: subreddit,
      title,
      text,
    }),
  });

  const submitBody = await safeJson(submitRes);
  if (!submitRes.ok) throw new Error(`reddit_submit_failed_${submitRes.status}:${JSON.stringify(submitBody)}`);

  return { id: submitBody?.json?.data?.id ?? null, raw: submitBody };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return { text: await res.text().catch(() => "") };
  }
}
