// Shared "database" for BlueClaws IQ — JSON metadata buckets in Netlify Blobs.
//
// Buckets are deliberately SEPARATE (not one blob): each open browser re-downloads
// its bucket on every poll, so byte-heavy data was split off over time to stop the
// 8-second poll from timing out (502s). DO NOT merge these back into one blob.
//   overrides -> sponsor edits (polled every 8s)      logos   -> logo metadata
//   photos    -> photo-library metadata               displays -> Ballpark Displays
// Raw image/logo BYTES live in media.js; this file holds only small reference URLs.
//
// TO ADD A NEW SERVER-SYNCED ITEM TYPE: add its name to VALID_BUCKETS below — that
// is the ONLY server change needed. Anything not on the list falls back to
// "overrides" so a typo can't silently create an unbounded new blob.
//
// GET  ?bucket=<name>                 -> current object for that bucket
// GET  ?bucket=<name>&reset=yes-really -> wipes that bucket to {} (use once to clear a
//      stuck/oversized blob; each browser repopulates from its own local copy on next save)
// POST { id, patch, bucket }          -> merges patch into bucket[id]; bucket defaults
//      to "overrides" if omitted (keeps old clients working)
const { cors, openStore } = require("./lib/store.js");

const CORS_HEADERS = cors("GET, POST, OPTIONS", { "Content-Type": "application/json" });
const VALID_BUCKETS = new Set(["overrides", "logos", "photos", "displays"]);

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  try {
    const store = await openStore("blueclaws-iq-data");

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
