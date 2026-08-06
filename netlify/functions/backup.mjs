// ============================================================================
//  BlueClaws IQ — "backup" function       (Netlify Scheduled Function — SERVER)
// ============================================================================
//  WHAT IT DOES
//    Runs on a daily schedule (Netlify's own cron trigger — see `config` below,
//    not GitHub Actions, so it doesn't depend on that working). Snapshots the
//    four small JSON buckets from data.js (overrides, logos, photos, displays)
//    into a separate Netlify Blobs store, so a bad edit or a bug that corrupts
//    sponsor data has something to roll back to. Old snapshots are pruned after
//    30 days so the backup store doesn't grow forever.
//
//  WHAT IT DELIBERATELY DOES NOT BACK UP
//    Image bytes (media.js) and contract PDFs (contracts.mjs) — those are
//    write-once blobs identified by opaque ids, not records that get silently
//    edited in place, so the realistic failure mode (a bad edit corrupting
//    structured data) doesn't apply to them the same way. Backing up
//    potentially gigabytes of binary blobs daily would also make this function
//    far slower and more expensive for comparatively little protection.
//
//  HOW TO RESTORE
//    Netlify Blobs doesn't have a UI browser for this yet, so restoring means
//    writing a one-off script (or a temporary function) that reads
//    "<store: blueclaws-iq-backups>/<YYYY-MM-DD>.json" and writes each bucket
//    back into the "blueclaws-iq-data" store with store.setJSON(bucket, value).
//    Snapshots are named by date, e.g. 2026-08-06.json.
//
//  REQUIRES: this repo's existing BLOBS_SITE_ID / BLOBS_TOKEN env vars — no new
//  setup needed. Netlify Scheduled Functions need to be available on your
//  site's plan; if this never runs, check the function's logs in the Netlify
//  dashboard (Functions tab) for a plan/entitlement error.
// ============================================================================
import { getStore } from "@netlify/blobs";

export const config = { schedule: "0 8 * * *" }; // daily, 8:00 UTC

const BUCKETS = ["overrides", "logos", "photos", "displays"];
const RETENTION_DAYS = 30;

function blobStore(name) {
  return getStore({
    name,
    consistency: "strong",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

export default async () => {
  const source = blobStore("blueclaws-iq-data");
  const backups = blobStore("blueclaws-iq-backups");

  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const snapshot = { takenAt: new Date().toISOString(), buckets: {} };
  for (const bucket of BUCKETS) {
    snapshot.buckets[bucket] = (await source.get(bucket, { type: "json" })) || {};
  }
  await backups.setJSON(`${stamp}.json`, snapshot);

  let pruned = 0;
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const { blobs } = await backups.list();
    for (const b of blobs) {
      const m = b.key.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (m && new Date(`${m[1]}T00:00:00Z`).getTime() < cutoff) {
        await backups.delete(b.key);
        pruned++;
      }
    }
  } catch (e) {
    // Pruning failure shouldn't fail the backup itself — an extra old snapshot lying
    // around is harmless, unlike a missing one.
  }

  return new Response(
    JSON.stringify({ ok: true, snapshot: `${stamp}.json`, buckets: BUCKETS, pruned }),
    { headers: { "Content-Type": "application/json" } }
  );
};
