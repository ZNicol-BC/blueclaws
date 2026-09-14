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
  const options = {};
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
function parseRequestList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function requestKey(request) {
  if (!request || typeof request !== "object") return "";
  return String(request.id || request.rootId || "").trim();
}
function requestStamp(request) {
  const raw = request && (request.updatedAt || request.requestedAt || request.createdAt || request.dueDate);
  const time = raw ? Date.parse(raw) : 0;
  return Number.isFinite(time) ? time : 0;
}
function mergeRequestListValues(existingValue, incomingValue) {
  const existing = parseRequestList(existingValue);
  const incoming = parseRequestList(incomingValue);
  const byId = new Map();
  const order = [];
  for (const request of existing) {
    const key = requestKey(request);
    if (!key) continue;
    byId.set(key, request);
    order.push(key);
  }
  for (const request of incoming) {
    const key = requestKey(request);
    if (!key) continue;
    const current = byId.get(key);
    if (!current) {
      order.push(key);
      byId.set(key, request);
      continue;
    }
    // Whole-store request saves can come from an older browser tab. Keep every
    // known request ID and let the newer copy of the same ID win when possible.
    byId.set(key, requestStamp(request) >= requestStamp(current) ? { ...current, ...request } : { ...request, ...current });
  }
  return JSON.stringify(order.map((key) => byId.get(key)).filter(Boolean));
}
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  try {
    const { connectLambda, getStore } = await import("@netlify/blobs");
    if (typeof connectLambda === "function") connectLambda(event);
    const store = openBlobStore(getStore, "blueclaws-iq-data");
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      const bucketParam = params.bucket || "overrides";
      const bucket = VALID_BUCKETS.has(bucketParam) ? bucketParam : "overrides";
      if (params.reset === "yes-really") {
        await store.setJSON(bucket, {});
        await store.setJSON(sidecarIndexKey(bucket), []);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ reset: bucket, ok: true }) };
      }
      if (params.id) {
        const id = String(params.id);
        const bucketData = await readJSON(store, bucket, {});
        const record = await readJSON(store, sidecarRecordKey(bucket, id), null);
        const merged = { ...(bucketData && bucketData[id] || {}), ...(record || {}) };
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(merged) };
      }
      const data = await readBucket(store, bucket);
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
        let count = 0;
        const sidecars = {};
        for (const [id, patch] of Object.entries(payload.bulk)) {
          if (!id || typeof patch !== "object" || patch === null || Array.isArray(patch)) continue;
          if (bucket === "overrides" && id === "requests" && Object.prototype.hasOwnProperty.call(patch, "value")) {
            const current = await readBucket(store, bucket);
            patch.value = mergeRequestListValues(current && current[id] && current[id].value, patch.value);
          }
          sidecars[id] = patch;
          count++;
        }
        await writeSidecars(store, bucket, sidecars);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, bucket, count }) };
      }
      const { id, patch } = payload;
      if (!id || typeof patch !== "object" || patch === null) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Body must be { id, patch }" }) };
      }
      if (bucket === "overrides" && id === "requests" && Object.prototype.hasOwnProperty.call(patch, "value")) {
        const current = await readBucket(store, bucket);
        patch.value = mergeRequestListValues(current && current[id] && current[id].value, patch.value);
      }
      await writeSidecars(store, bucket, { [id]: patch });
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ...(patch || {}), ok: true }) };
    }
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
