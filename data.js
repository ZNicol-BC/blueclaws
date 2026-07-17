const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};
const VALID_BUCKETS = new Set(["overrides", "logos", "photos"]);

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
