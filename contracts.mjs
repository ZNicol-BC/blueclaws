// BlueClaws IQ — contract/agreement PDF storage on the server (Netlify Blobs).
// The app (index.html) uploads agreement files here instead of storing them in the browser.
// Files are keyed by the app's composite key (sponsorId, or sponsorId::aid, sanitized).
// Large PDFs arrive in <=3MB chunks (Netlify functions cap request bodies at ~6MB), and the
// final chunk assembles them into one blob. GET streams the file back; DELETE removes it.
//
// Deploy: drop this file at netlify/functions/contracts.mjs in the repo and push. @netlify/blobs
// is provided by the Netlify runtime automatically — no install or config needed.
import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const store = getStore("bciq-contracts");

  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });
  if (!id) return json({ error: "missing id" }, 400);

  try {
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
