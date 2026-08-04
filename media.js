// Stores and serves individual photo/logo BYTES, outside the JSON metadata buckets
// in data.js. Keeping bytes here means data.js's polled buckets hold only a small
// ?id= reference each, so their size stops growing with photo *content*.
//
// GET  ?id=<id>              -> streams the stored bytes with a long-lived, immutable
//                                Cache-Control (fetched once per browser/CDN edge).
// POST { id, dataUrl }       -> decodes a base64 data: URL and stores the raw bytes
//                                + content type under that id. One call per upload.
const { cors, openStore } = require("./lib/store.js");

const CORS_HEADERS = cors("GET, POST, OPTIONS");
const DATA_URL_RE = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([a-zA-Z0-9+/=]+)$/;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  try {
    const store = await openStore("blueclaws-iq-media");

    if (event.httpMethod === "GET") {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return { statusCode: 400, headers: CORS_HEADERS, body: "Missing id" };
      const result = await store.getWithMetadata(id, { type: "arrayBuffer" });
      if (!result || !result.data) return { statusCode: 404, headers: CORS_HEADERS, body: "Not found" };
      const contentType = (result.metadata && result.metadata.contentType) || "application/octet-stream";
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
        body: Buffer.from(result.data).toString("base64"),
        isBase64Encoded: true,
      };
    }

    if (event.httpMethod === "POST") {
      let payload;
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON body" }) };
      }
      const { id, dataUrl } = payload;
      const match = typeof dataUrl === "string" && dataUrl.match(DATA_URL_RE);
      if (!id || !match) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Body must be { id, dataUrl } with a base64 data: URL" }) };
      }
      const contentType = match[1];
      const bytes = Buffer.from(match[2], "base64");
      await store.set(id, bytes, { metadata: { contentType } });
      return { statusCode: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, id }) };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: "Method not allowed" };
  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
