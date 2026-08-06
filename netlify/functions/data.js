// ============================================================================
//  BlueClaws IQ — "data" function        (Netlify Function — runs on the SERVER)
// ============================================================================
//  WHAT IT DOES
//    The app's shared database for small text data. It reads and writes JSON
//    "buckets" in Netlify Blobs (Netlify's built-in storage — no separate
//    database, account, or API key to manage).
//
//  WHERE THE DATA LIVES
//    On the server, in Netlify Blobs. Nothing here is stored in anyone's
//    browser — this file IS the server side. Credentials come from two
//    environment variables already set on the Netlify site:
//      BLOBS_SITE_ID  and  BLOBS_TOKEN
//
//  THE BUCKETS (why there are four, not one)
//    Every open browser re-downloads its data every few seconds. If everything
//    lived in one big blob, that download got huge and slow (it caused timeouts
//    / "502" errors in the past). So the data is split by type so each stays
//    small:
//      overrides -> sponsor edits        (checked often, every ~8 seconds)
//      logos     -> logo info
//      photos    -> photo-library info
//      displays  -> Ballpark Displays    (checked slower, every ~60 seconds)
//    ⚠️ Do NOT merge these back into one bucket — the split is what keeps it fast.
//    (Actual image BYTES do not live here — they live in media.js. This file
//     only holds small text records, including short links to those images.)
//
//  HOW THE APP CALLS IT
//    GET  ?bucket=overrides            -> returns that bucket's current data
//    GET  ?bucket=<name>&reset=yes-really -> empties that bucket to {} (emergency
//         reset for a stuck/oversized bucket; safe — each browser re-saves its
//         own data on its next save)
//    POST body { id, patch, bucket }   -> merges "patch" into bucket[id]
//         (bucket defaults to "overrides" if left out)
//
//  TO ADD A NEW KIND OF SAVED ITEM LATER
//    Add its name to VALID_BUCKETS below — that's the only server change needed.
//    Anything not on the list falls back to "overrides", so a typo can't quietly
//    create a giant new bucket.
// ============================================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};
const VALID_BUCKETS = new Set(["overrides", "logos", "photos", "displays"]);
exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  // Requires a signed-in Netlify Identity user (see index.html's bciqFetch, which attaches
  // the Authorization: Bearer <token> header). Netlify verifies that token and populates
  // context.clientContext.user before this function ever runs — no verification to do here,
  // just check it showed up.
  if (!context.clientContext || !context.clientContext.user) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Sign in required" }) };
  }
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({
      name: "blueclaws-iq-data",
      consistency: "strong",
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      const bucketParam = params.bucket || "overrides";
      const bucket = VALID_BUCKETS.has(bucketParam) ? bucketParam : "overrides";
      if (params.reset === "yes-really") {
        await store.setJSON(bucket, {});
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ reset: bucket, ok: true }) };
      }
      const data = (await store.get(bucket, { type: "json" })) || {};
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
    }
    if (event.httpMethod === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON body" }) };
      }
      const { id, patch } = payload;
      const bucket = VALID_BUCKETS.has(payload.bucket) ? payload.bucket : "overrides";
      if (!id || typeof patch !== "object" || patch === null) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Body must be { id, patch }" }) };
      }
      const data = (await store.get(bucket, { type: "json" })) || {};
      data[id] = { ...(data[id] || {}), ...patch };
      await store.setJSON(bucket, data);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data[id]) };
    }
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
