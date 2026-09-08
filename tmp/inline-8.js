


// One-time realignment: match each tagged photo's popAsset label against the sponsor's
// real asset catalog lines (parseSponsorAssetLines) so the asset dropdown in the photo
// tag modal auto-selects correctly. The MSR seed URLs above carry labels straight from
// Digideck (often with a distributor/brand suffix in parens, e.g. "Digital Marquee (Coors)")
// that don't exactly match the catalog line text, so the dropdown showed blank even though
// the photo was already tagged. Only rewrites popAsset when a confident match is found;
// leaves ambiguous/no-match cases untouched rather than forcing a wrong pairing.
(function () {
  try {
    if (typeof memStore === "undefined" || typeof loadPhotoLibrary !== "function") return;
    var FLAG = "bciq_photo_asset_align_v1";
    if (memStore.getItem(FLAG)) return;
    if (typeof getRecord !== "function" || typeof parseSponsorAssetLines !== "function") return;
    var norm = function (s) {
      return (s || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    };
    var lib = loadPhotoLibrary();
    var changedIds = {};
    lib.forEach(function (p) {
      if (!p.sponsorId || !p.popAsset) return;
      var rec = getRecord(p.sponsorId);
      if (!rec) return;
      var lines = parseSponsorAssetLines(rec.assets);
      if (!lines.length) return;
      if (lines.some(function (l) { return l.text === p.popAsset; })) return; // already exact
      var target = norm(p.popAsset);
      if (target.length < 3) return;
      var best = null, bestLen = 0;
      lines.forEach(function (l) {
        var lt = norm(l.text);
        if (!lt) return;
        if (lt === target || lt.indexOf(target) === 0 || target.indexOf(lt) === 0) {
          if (lt.length > bestLen) { best = l; bestLen = lt.length; }
        }
      });
      if (best) {
        p.popAsset = best.text;
        changedIds[p.id] = true;
      }
    });
    var changed = Object.keys(changedIds).length;
    if (changed) {
      savePhotoLibraryLocalOnly(lib);
      lib.forEach(function (p) {
        if (!changedIds[p.id]) return;
        /* index242 — the build-241 audit flagged this as bypassing the retry queue. It does
           not: pushSharedData calls queueSharedWrite and flushSharedQueue itself, so photo
           writes already get the same retry, backoff and dead-letter treatment as overrides.
           The one real defect was the empty catch, which discarded the fact that a photo had
           failed to even reach the queue. That is now logged rather than dropped. */
        try { pushSharedData(p.id, { dataUrl: p.dataUrl, sponsorId: p.sponsorId, sponsorName: p.sponsorName, popAsset: p.popAsset, addedAt: p.addedAt, deleted: false }, "photos"); }
        catch (e) { console.error("[BCIQ] photo sync could not be queued for " + p.id, e); }
      });
    }
    memStore.setItem(FLAG, "1");
    if (typeof renderPhotoLibrary === "function") renderPhotoLibrary();
  } catch (e) { /* alignment is best-effort; never block app load */ }
})();


