// This function is the shared "database" for BlueClaws IQ.
// It stores one JSON object (all sponsor edits) in Netlify Blobs — Netlify's own
// built-in storage, no external account or API key needed.
//
// GET  -> returns the current shared edits object
// POST -> body: { id, patch } -> merges patch into that sponsor's shared edits, returns the result

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "blueclaws-iq-data", consistency: "strong" });

    if (event.httpMethod === "GET") {
      const data = (await store.get("overrides", { type: "json" })) || {};
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
      if (!id || typeof patch !== "object" || patch === null) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Body must be { id, patch }" }) };
      }
      const data = (await store.get("overrides", { type: "json" })) || {};
      data[id] = { ...(data[id] || {}), ...patch };
      await store.setJSON("overrides", data);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data[id]) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
