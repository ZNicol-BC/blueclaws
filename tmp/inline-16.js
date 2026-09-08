
/* ============================================================================
   index233 — SELF-REFLECTIVE BEHAVIOURS
   Two things here, both built on the same idea: a component should re-measure itself when the
   thing it describes changes, rather than showing whatever was true when it was first painted.
   ========================================================================= */
(function(){
  /* ---- 1. Daily notes becomes a shared sticky note ----
     Same textarea, same `dailyNotes` sync channel, same autosave — only its home and its skin
     change. Lifted out of the glance row so patch notes can lead, and pinned where a note actually
     belongs. Collapse state is remembered per browser; the note content stays shared. */
  var COLLAPSE_KEY = "bciq_sticky_collapsed";
  function makeSticky(){
    var card = document.querySelector(".glance-card.gc-notes");
    if (!card || card.dataset.sticky) return;
    card.dataset.sticky = "1";
    card.classList.remove("card", "glance-card", "gc-notes");
    card.classList.add("sticky-note");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "sticky-toggle";
    btn.setAttribute("aria-label", "Collapse or expand the shared note");
    var collapsed = false;
    try { collapsed = localStorage.getItem(COLLAPSE_KEY) === "1"; } catch(e){}
    function paint(){
      card.classList.toggle("is-collapsed", collapsed);
      btn.textContent = collapsed ? "+" : "–";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    btn.addEventListener("click", function(){
      collapsed = !collapsed;
      try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch(e){}
      paint();
    });
    card.appendChild(btn);
    paint();
    /* index234: the note stays INSIDE the glance grid rather than being pinned to the viewport.
       Floating bottom-right, it sat on top of the Recently updated card and the assistant orb —
       a note that covers the thing you were reading is worse than no note. It now occupies its own
       full-width row beneath the two feeds: always visible, never overlapping, and still styled as
       a sticky note so it reads as a scratchpad rather than another data card. */
  }

  /* ---- 2. The storage panel re-measures itself ----
     Every path that writes shared data invalidates the 60s server-size cache and, if the panel is
     on screen, repaints it. So the bar is never stale after an upload, a photo save or a contract
     attach — it reflects the store as it is now, not as it was when Backup was opened. */
  function invalidateStorage(){
    try { __bciqServerSizeCache = { at: 0, data: null, error: null }; } catch(e){}
    var panel = document.getElementById("storagePanel");
    if (panel && panel.offsetParent !== null && typeof renderStoragePanel === "function") {
      try { renderStoragePanel(); } catch(e){}
    }
  }
  window.bciqInvalidateStorage = invalidateStorage;
  ["pushSharedData","saveOverrides","saveBallparkDisplays","savePhotoLibrary"].forEach(function(fnName){
    var orig = window[fnName];
    if (typeof orig !== "function" || orig.__storWrapped) return;
    window[fnName] = function(){
      var r = orig.apply(this, arguments);
      try { setTimeout(invalidateStorage, 400); } catch(e){}
      return r;
    };
    window[fnName].__storWrapped = true;
  });
  /* Also refresh while the Backup dialog sits open, so a teammate's upload shows up here. */
  setInterval(function(){
    var panel = document.getElementById("storagePanel");
    if (panel && panel.offsetParent !== null && typeof renderStoragePanel === "function") {
      try { renderStoragePanel(); } catch(e){}
    }
  }, 30000);

  /* ---- index241 (self-reflective pass): kill the declared literals ----
     Four values were typed into the markup and only corrected later by whichever render function
     happened to own them: the sidebar sponsor count (typed as 128, actually 195) and three season
     badges (typed as 2026). Two failure modes: the wrong value is visible until that render runs,
     and if the view is never opened the literal is what people see — a badge that would still say
     2026 through the whole of next season.

     They now start as "—" (an explicit unknown, never a confident wrong number) and are filled from
     their real sources at boot: the sponsor count from getAllRecords(), the season badges from
     sState.season, which is the same value the ledger and every report already run on. Re-derived
     whenever the season selector changes, so they can't drift. */
  function refreshDerivedLabels(){
    try {
      var el = document.getElementById("sponsorCount");
      if (el && typeof getAllRecords === "function") el.textContent = getAllRecords().length;
    } catch (e) {}
    try {
      var season = (typeof sState !== "undefined" && sState && sState.season) ? sState.season : null;
      if (season) ["scoreboardSeasonBadge", "enewsSeasonBadge", "agrHubBadge"].forEach(function (id) {
        var n = document.getElementById(id);
        /* Only fill the unknown. A view's own renderer may set a more specific year (the
           e-newsletter and agreements hubs each derive their own), and this must not overwrite it. */
        if (n && (!n.textContent || n.textContent.trim() === "—")) n.textContent = season;
      });
    } catch (e) {}
  }
  window.bciqRefreshDerivedLabels = refreshDerivedLabels;

  function boot(){
    makeSticky();
    refreshDerivedLabels();
    /* Season is the one input that invalidates all of them at once. */
    var sel = document.getElementById("seasonSelect");
    if (sel && !sel.dataset.derivedWired) {
      sel.dataset.derivedWired = "1";
      sel.addEventListener("change", function(){ setTimeout(refreshDerivedLabels, 120); });
    }
    /* Fallback for counts that change from other browsers on the sync poll. Cheap, and it only
       ever writes a number that already changed. */
    setInterval(refreshDerivedLabels, 15000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

