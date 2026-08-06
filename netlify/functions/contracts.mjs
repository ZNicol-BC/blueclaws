// ============================================================================
//  BlueClaws IQ — "contracts" function   (Netlify Function — runs on the SERVER)
// ============================================================================
//  WHAT IT DOES
//    Stores and serves sponsor agreement/contract PDFs on the server, so the
//    files sync between browsers instead of being trapped in one person's
//    browser. Each PDF is keyed by the app's id (e.g. sponsorId or
//    sponsorId::assetId).
//
//  WHERE THE DATA LIVES
//    On the server, in Netlify Blobs. Nothing is stored in the browser.
//    Credentials come from the site's env vars BLOBS_SITE_ID and BLOBS_TOKEN
//    (the same ones data.js uses — no extra setup).
//
//  HOW THE APP CALLS IT
//    POST ?id=<id>            -> upload a PDF. Big PDFs come in <=3MB chunks
//         (?parts=N&part=i); the last chunk is stitched together into one file.
//    GET  ?id=<id>            -> download / view the PDF
//    DELETE ?id=<id>          -> remove the PDF
//
//  WHY "strong consistency" (don't remove it)
//    The chunked upload writes each piece then immediately reads them back to
//    reassemble. Strong consistency guarantees a just-written piece reads back
//    correctly; without it, assembly could fail with "missing part N".
//
//  NOTE: this file uses modern Netlify syntax (export default / Request /
//  Response), which fits its binary file handling. data.js and media.js use the
//  older syntax — both are fine; don't feel you must make them match.
// ============================================================================
import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function contractStore() {
  return getStore({
    name: "bciq-contracts",
    consistency: "strong",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });
  // Every call to this function goes through index.html's bciqFetch(), which attaches the
  // signed-in Netlify Identity token — contracts are real legal documents, so every method
  // (including GET) requires sign-in, unlike media.js where GET stays open.
  if (!context.clientContext || !context.clientContext.user) {
    return json({ error: "Sign in required" }, 401);
  }
  if (!id) return json({ error: "missing id" }, 400);

  try {
    // Created inside the try so any storage-config problem returns a clean JSON 500
    // with the real message (visible to the app) instead of crashing opaquely.
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
