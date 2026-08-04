// netlify/functions/media.mjs
// Stores sponsor LOGOS and GRAPHICS on the server (Netlify Blobs) so they live on Netlify, not
// only in each browser. BlueClaws IQ calls this at /.netlify/functions/media:
//   POST  { id, dataUrl }              -> decodes the data: URL, stores the bytes; returns { ok }
//   GET   ?id=<id>                     -> streams the image bytes back (used directly as <img src>)
//   DELETE ?id=<id>                    -> removes it
//
// After a POST, the app syncs only a tiny reference URL (/.netlify/functions/media?id=<id>) through
// the "logos" bucket instead of the full base64 — so the sync payload stays small and the image
// itself lives on Netlify. The local copy the app keeps is just a fast cache.
//
// Deploy: drop this at netlify/functions/media.mjs and push. Uses the SAME explicit Blobs creds +
// strong consistency as contracts.mjs (env vars BLOBS_SITE_ID / BLOBS_TOKEN already set for data.js),
// so read-after-write is reliable and the automatic-context config error can't 500 the upload.
import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function mediaStore() {
  return getStore({
    name: "bciq-media",
    consistency: "strong",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });

  try {
    const store = mediaStore();

    if (req.method === "POST") {
      const { id, dataUrl } = await req.json();
      if (!id || !dataUrl) return json({ error: "missing id or dataUrl" }, 400);
      const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
      if (!m) return json({ error: "dataUrl must be base64" }, 400);
      const type = m[1] || "image/png";
      const bytes = Buffer.from(m[2], "base64");
      await store.set(id, bytes, { metadata: { type } });
      return json({ ok: true, id });
    }

    const id = url.searchParams.get("id");
    if (!id) return json({ error: "missing id" }, 400);

    if (req.method === "GET") {
      const blob = await store.get(id, { type: "arrayBuffer" });
      if (!blob) return json({ error: "not found" }, 404);
      const info = await store.getMetadata(id);
      const type = (info && info.metadata && info.metadata.type) || "image/png";
      return new Response(blob, {
        status: 200,
        headers: { ...CORS, "Content-Type": type, "Cache-Control": "public, max-age=86400" },
      });
    }

    if (req.method === "DELETE") {
      await store.delete(id);
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
