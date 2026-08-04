// Shared helper for all three Netlify functions (data / media / contracts).
// Lives in a SUBDIRECTORY (netlify/functions/lib/) on purpose: Netlify only turns
// top-level files in netlify/functions/ into HTTP endpoints, so a file in lib/ is
// bundled into the functions that import it but is NOT itself a public endpoint.
//
// This removes the three near-identical copies of (a) the CORS headers and
// (b) the getStore({ siteID, token, consistency }) config that were pasted into
// data.js, media.js, and contracts.mjs. One place to change credentials or CORS.
//
// Both credentials come from env vars already set for the site:
//   BLOBS_SITE_ID, BLOBS_TOKEN
// Strong consistency is required (read-after-write is used in the chunked
// contract-upload path and by the poll-then-save flow).

const BASE_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Build the CORS block for a function. Each function keeps its own allowed
// methods (and data.js adds a default JSON Content-Type) so behaviour is identical
// to the old inline copies.
function cors(methods = "GET, POST, OPTIONS", extra = {}) {
  return { ...BASE_CORS, "Access-Control-Allow-Methods": methods, ...extra };
}

// Open a strongly-consistent Blobs store by name with explicit credentials.
// (Dynamic import keeps this working under both CommonJS and ESM callers.)
async function openStore(name) {
  const { getStore } = await import("@netlify/blobs");
  return getStore({
    name,
    consistency: "strong",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

module.exports = { cors, openStore };
