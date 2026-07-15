// This function is the shared "database" for BlueClaws IQ.
// It stores data in Netlify Blobs — Netlify's own built-in storage, no external
// account or API key needed.
//
// CHANGED (July 2026): logos now live in a SEPARATE blob ("logos") from sponsor
// edits ("overrides"). Before this, everything shared one blob — as real logo
// uploads piled in, that blob grew large enough that every 8-second poll (from
// every open browser) started timing out, which is why GET requests were
// coming back as 502s. Splitting them means the frequent small poll (sponsor
// edits) stays light, and the heavier, slower-changing logo data is fetched
// on its own, less-frequent schedule by the client.
//
// GET  ?bucket=overrides (default) -> returns the current shared sponsor-edit object
// GET  ?bucket=logos              -> returns the current shared logo object
// POST body: { id, patch, bucket } -> merges patch into that bucket's record for id,
//            bucket defaults to "overrides" if omitted (keeps old clients working)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};
const VALID_BUCKETS = new Set(["overrides", "logos"]);

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
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
      const bucketParam = (event.queryStringParameters && event.queryStringParameters.bucket) || "overrides";
      const bucket = VALID_BUCKETS.has(bucketParam) ? bucketParam : "overrides";
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
