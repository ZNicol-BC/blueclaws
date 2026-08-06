// ============================================================================
//  BlueClaws IQ — "media" function       (Netlify Function — runs on the SERVER)
// ============================================================================
//  WHAT IT DOES
//    Stores and serves the actual BYTES of photos and logos (the image files),
//    kept separate from the small text records in data.js.
//
//  WHY IT'S SEPARATE FROM data.js
//    Image files are large. If their bytes lived inside data.js's buckets, those
//    buckets would balloon and slow down every browser's frequent check-ins. So
//    the bytes live here (one entry per image), and data.js only keeps a tiny
//    link (?id=...) pointing at them. This keeps everything fast as the photo
//    library grows.
//
//  WHERE THE DATA LIVES
//    On the server, in Netlify Blobs. Nothing is stored in the browser.
//    Credentials come from the site's env vars BLOBS_SITE_ID and BLOBS_TOKEN.
//
//  HOW THE APP CALLS IT
//    GET  ?id=<id>          -> streams the image back (cached hard, so each image
//                             is only downloaded once per browser)
//    POST body { id, dataUrl } -> saves one image. "dataUrl" is a base64 data URL
//                             (e.g. "data:image/png;base64,....") which this
//                             decodes into real bytes. One call per upload.
// ============================================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
const DATA_URL_RE = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([a-zA-Z0-9+/=]+)$/;
// Same shared-passphrase check as data.js (see there for why it's not hardcoded).
function isAuthorized(event) {
  const expected = process.env.BCIQ_SHARED_PASSWORD;
  if (!expected) return false;
  const header = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  return given === expected;
}
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  // Only the write path (POST) requires the passphrase. GET stays open: images are displayed
  // via plain <img src="...?id=..."> tags all over the app, which can't carry an Authorization
  // header, so gating GET would break every logo/photo on the page. Reading requires already
  // knowing a specific image's id; writing is the actual thing worth gating.
  if (event.httpMethod === "POST" && !isAuthorized(event)) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Passphrase required" }) };
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
