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
//    POST body { bulk, bucket }        -> merges many { id: patch } records in one
//         read/write. Used for photo recovery so hundreds of restored records do
//         not rewrite the full bucket hundreds of separate times.
//
//  TO ADD A NEW KIND OF SAVED ITEM LATER
//    Add its name to VALID_BUCKETS below — that's the only server change needed.
//    Anything not on the list falls back to "overrides", so a typo can't quietly
//    create a giant new bucket.
// ============================================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};
const VALID_BUCKETS = new Set(["overrides", "logos", "photos", "displays"]);
const sidecarIndexKey = (bucket) => `${bucket}__sidecar_index`;
const sidecarRecordKey = (bucket, id) => `${bucket}__sidecar__${Buffer.from(String(id)).toString("base64url")}`;
function openBlobStore(getStore, name) {
  const options = { consistency: "strong" };
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    options.siteID = process.env.BLOBS_SITE_ID;
    options.token = process.env.BLOBS_TOKEN;
  }
  try {
    return getStore({ name, ...options });
  } catch (e) {
    const missing = String(e && e.message || e).includes("environment has not been configured");
    if (missing && (!process.env.BLOBS_SITE_ID || !process.env.BLOBS_TOKEN)) {
      throw new Error("Netlify Blobs is not configured for this site. Set BLOBS_SITE_ID and BLOBS_TOKEN in Netlify Environment Variables so BlueClaws IQ can save shared team data.");
    }
    throw e;
  }
}
async function readJSON(store, key, fallback) {
  try {
    const value = await store.get(key, { type: "json" });
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}
async function readBucket(store, bucket) {
  const data = await readJSON(store, bucket, {});
  const index = await readJSON(store, sidecarIndexKey(bucket), []);
  const ids = Array.isArray(index) ? index : Object.keys(index || {});
  for (const id of ids) {
    const record = await readJSON(store, sidecarRecordKey(bucket, id), null);
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    data[id] = { ...(data[id] || {}), ...record };
  }
  return data;
}
async function writeSidecars(store, bucket, records) {
  const existing = await readJSON(store, sidecarIndexKey(bucket), []);
  const ids = new Set(Array.isArray(existing) ? existing : Object.keys(existing || {}));
  for (const [id, record] of Object.entries(records)) {
    if (!id || !record || typeof record !== "object" || Array.isArray(record)) continue;
    ids.add(id);
    await store.setJSON(sidecarRecordKey(bucket, id), record);
  }
  await store.setJSON(sidecarIndexKey(bucket), Array.from(ids));
}
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = openBlobStore(getStore, "blueclaws-iq-data");
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
      const bucket = VALID_BUCKETS.has(payload.bucket) ? payload.bucket : "overrides";
      if (payload.bulk && typeof payload.bulk === "object" && !Array.isArray(payload.bulk)) {
        const data = (await store.get(bucket, { type: "json" })) || {};
        let count = 0;
        for (const [id, patch] of Object.entries(payload.bulk)) {
          if (!id || typeof patch !== "object" || patch === null || Array.isArray(patch)) continue;
          data[id] = { ...(data[id] || {}), ...patch };
          count++;
        }
        await store.setJSON(bucket, data);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, bucket, count }) };
      }
      const { id, patch } = payload;
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
