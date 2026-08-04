// BlueClaws IQ — contract/agreement PDF storage on the server (Netlify Blobs).
// index.html uploads agreement files here instead of the browser. Keyed by the app's
// composite key (sponsorId, or sponsorId::aid, sanitized). Large PDFs arrive in <=3MB
// chunks (functions cap request bodies ~6MB); the final chunk assembles them into one
// blob. GET streams the file back; DELETE removes it.
//
// Store is created with EXPLICIT credentials + strong consistency (shared openStore),
// because the automatic Blobs context isn't always injected on this site, and the
// chunked read-after-write assembly needs strong consistency to not miss a just-written
// part. Env vars BLOBS_SITE_ID / BLOBS_TOKEN are already set for the site.
import shared from "./lib/store.js";
const { cors, openStore } = shared;

const CORS = cors("GET,POST,DELETE,OPTIONS");

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });
  if (!id) return json({ error: "missing id" }, 400);

  try {
    // Opened inside try so any Blobs-config problem returns a clean JSON 500 with the
    // real message (visible to the client) instead of crashing opaquely.
    const store = await openStore("bciq-contracts");

    if (req.method === "POST") {
      const parts = parseInt(url.searchParams.get("parts") || "1", 10);
      const part = parseInt(url.searchParams.get("part") || "0", 10);
      const name = url.searchParams.get("name") || "agreement.pdf";
      const type = url.searchParams.get("type") || "application/pdf";
      const body = await req.arrayBuffer();

      if (!parts || parts <= 1) {
        await store.set(id, body, { metadata: { name, type } });
        return json({ ok: true, id });
      }
      // chunked: stash each part, assemble when the last one lands
      await store.set(`${id}__part${part}`, body);
      if (part < parts - 1) return json({ ok: true, part });

      const chunks = [];
      let total = 0;
      for (let i = 0; i < parts; i++) {
        const b = await store.get(`${id}__part${i}`, { type: "arrayBuffer" });
        if (!b) return json({ error: `missing part ${i}` }, 400);
        const u = new Uint8Array(b); chunks.push(u); total += u.length;
      }
      const combined = new Uint8Array(total);
      let off = 0; for (const c of chunks) { combined.set(c, off); off += c.length; }
      await store.set(id, combined, { metadata: { name, type } });
      for (let i = 0; i < parts; i++) await store.delete(`${id}__part${i}`);
      return json({ ok: true, id, assembled: parts });
    }

    if (req.method === "GET") {
      const blob = await store.get(id, { type: "arrayBuffer" });
      if (!blob) return json({ error: "not found" }, 404);
      const info = await store.getMetadata(id);
      const type = info?.metadata?.type || "application/pdf";
      const name = (info?.metadata?.name || "agreement.pdf").replace(/"/g, "");
      return new Response(blob, {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": type,
          "Content-Disposition": `inline; filename="${name}"`,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    if (req.method === "DELETE") {
      await store.delete(id);
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
