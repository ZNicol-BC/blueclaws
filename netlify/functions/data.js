// This function is the shared "database" for BlueClaws IQ.
// It stores data in Netlify Blobs — Netlify's own built-in storage, no external
// account or API key needed.
//
// CHANGED (July 2026): logos now live in a SEPARATE blob ("logos") from sponsor
// edits ("overrides"). Before this, everything shared one blob — as real logo
// uploads piled in, that blob grew large enough that every 8-second poll (from
// every open browser) started timing out, which is why GET requests were
// coming back as 502s.
//
// CHANGED AGAIN (July 2026, same day): after splitting, "logos" started working
// fine but "overrides" kept 502ing on its own. That's because the *existing*
// overrides blob still had all the old logo data baked into it from before the
// split — the split only changes where NEW writes go, it doesn't clean up what
// was already there. Added a one-time reset switch below to clear it out.
//
// GET  ?bucket=overrides (default) -> returns the current shared sponsor-edit object
// GET  ?bucket=logos              -> returns the current shared logo object
// GET  ?bucket=overrides&reset=yes-really -> WIPES that bucket back to {} and returns
//      confirmation. Use this ONCE to clear a stuck/oversized blob, then remove the
//      reset visit — nothing on any browser is lost, each browser's edits still live
//      in its own local storage and will repopulate this blob the next time they save.
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
