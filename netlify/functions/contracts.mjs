// BlueClaws IQ — contract/agreement PDF storage on the server (Netlify Blobs).
// The app (index.html) uploads agreement files here instead of storing them in the browser.
// Files are keyed by the app's composite key (sponsorId, or sponsorId::aid, sanitized).
// Large PDFs arrive in <=3MB chunks (Netlify functions cap request bodies at ~6MB), and the
// final chunk assembles them into one blob. GET streams the file back; DELETE removes it.
//
// Deploy: drop this file at netlify/functions/contracts.mjs in the repo and push.
//
// FIX (matches netlify/functions/data.js, which already works): the store is now created with
// EXPLICIT credentials + strong consistency, instead of the bare getStore("bciq-contracts").
// Two bugs that caused "Server upload failed / PDFs don't save between browsers":
//   1) On this site the automatic Blobs context isn't always injected, so the bare getStore()
//      threw a config error -> the POST 500'd -> the client showed "upload failed". data.js only
//      works because it passes siteID/token from env; contracts must do the same.
//   2) Default Blobs consistency is "eventual". The chunked-upload path writes each part then
//      immediately reads all parts back to assemble them — under eventual consistency a
//      just-written part can read as missing, so assembly failed with "missing part N". Strong
//      consistency makes the read-after-write reliable.
// The env vars BLOBS_SITE_ID and BLOBS_TOKEN are already set for data.js, so no new config needed.
import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function contractStore() {
  return getStore({
    name: "bciq-contracts",
    consistency: "strong",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });
  if (!id) return json({ error: "missing id" }, 400);

  try {
    // Created inside the try so any Blobs-config problem returns a clean JSON 500 with the real
    // message (visible to the client) instead of crashing the function opaquely.
    const store = contractStore();

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
