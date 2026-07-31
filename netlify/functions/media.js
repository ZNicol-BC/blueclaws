// Stores and serves individual photo/logo bytes, OUTSIDE the JSON metadata buckets in
// data.js. Before this existed, every photo/logo's full base64 body lived inside one of
// data.js's JSON blobs — the same blob every open browser re-downloads on every poll, and
// which gets read in full, patched, and rewritten in full on every single upload. That's
// unbounded: the bigger the photo library gets, the bigger every poll and every write gets,
// which is exactly what already forced logos and displays onto their own buckets once (see
// the comments atop data.js) and would eventually force this again as more seasons of photos
// pile up. Bytes now live here, one blob per id; data.js's buckets hold only a small
// reference URL (?id=...) to this endpoint, so their size stops growing with photo *content*
// and only grows with photo *count* (a few hundred bytes of metadata each).
//
// GET  ?id=<id>              -> streams the stored bytes with a long-lived, immutable
//                                Cache-Control, so a given id's bytes are ever fetched once
//                                per browser (or CDN edge) no matter how many times it's
//                                rendered or how many browsers request it.
// POST body: { id, dataUrl } -> decodes a data: URL and stores the raw bytes + content type
//                                under that id. Called once per new photo/logo upload.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const DATA_URL_RE = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([a-zA-Z0-9+/=]+)$/;
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({
      name: "blueclaws-iq-media",
      consistency: "strong",
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });
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
        isBase64Encoded: true
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
