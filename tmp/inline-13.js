
/* ============================================================================
   index230 — TAB VISIBILITY
   A per-person display filter over the workspace. The registry is INTROSPECTED from the live DOM,
   not hand-maintained: chapters come from .nav-chapter, pages from the .nav-item[data-view] inside
   them, and sub-tabs from any [data-subtab] strip inside that page's own section. Add a page or a
   sub-tab to the markup later and it appears in Settings by itself.

   Hiding is display-only. It never touches records, never affects anyone else's browser, and the
   underlying view stays fully functional if reached by deep link — this is about clearing a nav of
   things a particular person does not use (Mid-Season Report Assets being the motivating example),
   not about permissions.
   ========================================================================= */
(function(){
  function txt(el){ return el ? String(el.textContent||"").replace(/\s+/g," ").trim() : ""; }

  /* Chapter → pages → sub-tabs, straight off the document. */
  window.bciqTabRegistry = function(){
    var out = [];
    document.querySelectorAll(".nav-chapter[data-chapter]").forEach(function(chap){
      var head = chap.querySelector(".chapter-head");
      /* The chapter head carries a leading glyph, a live count badge and a trailing chevron. Strip
         all three so Settings reads "Service Center", not "% Service Center 195 ›". */
      var headClone = head ? head.cloneNode(true) : null;
      if (headClone) headClone.querySelectorAll(".nav-count,.badge,.count,.chev,[id$='Count']").forEach(function(n){ n.remove(); });
      var label = txt(headClone)
        .replace(/[›»>]+\s*$/,"")
        .replace(/^[^A-Za-z0-9]+/,"")
        .replace(/\s*\d+\s*$/,"")
        .trim();
      var group = { id: chap.getAttribute("data-chapter")||"", label: label || "Workspace", pages: [] };
      chap.querySelectorAll(".nav-item[data-view]").forEach(function(item){
        var view = item.getAttribute("data-view");
        if (!view) return;
        var section = document.getElementById(view + "View");
        if (!section) return;
        /* Prefer the nav label, minus any count badge that rides inside it. */
        var clone = item.cloneNode(true);
        clone.querySelectorAll(".nav-count,.badge,.count,[id$='Count']").forEach(function(n){ n.remove(); });
        /* Same treatment as the chapter head: drop the leading glyph and any trailing count so the
           settings list reads as plain page names. */
        var pageLabel = txt(clone).replace(/^[^A-Za-z0-9]+/,"").replace(/\s*\d+\s*$/,"").trim();
        var page = { view: view, label: pageLabel || view, subs: [] };
        var seen = {};
        section.querySelectorAll("[data-subtab]").forEach(function(btn){
          var key = btn.getAttribute("data-subtab");
          if (!key || seen[key]) return;
          seen[key] = 1;
          page.subs.push({ key: key, label: txt(btn) || key });
        });
        group.pages.push(page);
      });
      if (group.pages.length) out.push(group);
    });
    return out;
  };

  /* index236: tab visibility is now a SHARED setting, not a per-browser one.
     It lived in loadSettings()/saveSettings(), which is localStorage scoped to a profile name on
     one machine — so hiding Mid-Season Report Assets on your laptop left it visible for everyone
     else, and for you on any other browser. It now rides the "hiddenTabs" whole-store sync channel
     (registered alongside dailyNotes and stageProbs), so hiding a tab hides it for the team and
     follows you between machines. The pull loop applies incoming changes automatically.

     Migration: anything previously saved in per-profile settings is adopted once, then the shared
     store is authoritative. First run with no stored value at all seeds the team default below. */
  var HIDDEN_TABS_KEY = "bciq_hidden_tabs";
  var DEFAULT_HIDDEN_TABS = {};
  var RESTORED_VISIBLE_TABS = {
    "sub:digideck:midphotocheck": true
  };
  function restoreVisibleTabs(map){
    var changed = false;
    map = map || {};
    Object.keys(RESTORED_VISIBLE_TABS).forEach(function(k){
      if (map[k]) {
        delete map[k];
        changed = true;
      }
    });
    return { map: map, changed: changed };
  }
  function hiddenMap(){
    var raw = null;
    try { raw = memStore.getItem(HIDDEN_TABS_KEY); } catch(e){}
    if (raw === null || raw === undefined) {
      /* One-time adoption of the old per-browser value, else the team default. */
      var legacy = null;
      try { legacy = loadSettings().hiddenTabs; } catch(e){}
      var seed = (legacy && Object.keys(legacy).length) ? legacy : DEFAULT_HIDDEN_TABS;
      var restoredSeed = restoreVisibleTabs(seed);
      seed = restoredSeed.map;
      try { memStore.setItem(HIDDEN_TABS_KEY, JSON.stringify(seed)); } catch(e){}
      try { pushSharedData("hiddenTabs", { value: JSON.stringify(seed) }); } catch(e){}
      return JSON.parse(JSON.stringify(seed));
    }
    try {
      var parsed = JSON.parse(raw) || {};
      var restored = restoreVisibleTabs(parsed);
      if (restored.changed) writeHidden(restored.map);
      return restored.map;
    } catch(e){ return {}; }
  }
  function writeHidden(map){
    var json = JSON.stringify(map || {});
    durableSet(HIDDEN_TABS_KEY, json, "your hidden-tab preference");   /* index242: was an empty catch */
    try { pushSharedData("hiddenTabs", { value: json }); } catch(e){}
    /* Keep the old location roughly in step so a rollback doesn't lose the choice. */
    try { saveSettings({ hiddenTabs: map }); } catch(e){}
  }
  window.bciqTabKey = function(view, sub){ return sub ? ("sub:" + view + ":" + sub) : ("view:" + view); };
  window.bciqIsTabHidden = function(view, sub){ return !!hiddenMap()[window.bciqTabKey(view, sub)]; };
  window.bciqSetTabHidden = function(view, sub, hidden){
    var m = hiddenMap(), k = window.bciqTabKey(view, sub);
    if (hidden) m[k] = true; else delete m[k];
    writeHidden(m);
    window.bciqApplyHiddenTabs();
  };

  /* Apply the filter to the running DOM. Safe to call as often as you like. */
  window.bciqApplyHiddenTabs = function(){
    var m = hiddenMap();
    var reg = window.bciqTabRegistry();
    var activeViewHidden = null;

    reg.forEach(function(group){
      var visiblePages = 0;
      group.pages.forEach(function(page){
        var hide = !!m["view:" + page.view];
        document.querySelectorAll('.nav-item[data-view="' + page.view + '"]').forEach(function(item){
          item.style.display = hide ? "none" : "";
        });
        if (!hide) visiblePages++;
        var section = document.getElementById(page.view + "View");
        if (hide && section && section.classList.contains("active")) activeViewHidden = page.view;

        /* Sub-tabs inside the page. */
        if (section){
          var visibleSubs = [];
          page.subs.forEach(function(sub){
            var subHide = !!m["sub:" + page.view + ":" + sub.key];
            section.querySelectorAll('[data-subtab="' + sub.key + '"]').forEach(function(btn){
              btn.style.display = subHide ? "none" : "";
              if (!subHide) visibleSubs.push(btn);
              /* If the hidden sub-tab is the one currently selected, move to the first visible one. */
              if (subHide && btn.classList.contains("active")) btn.dataset.bciqWasActive = "1";
            });
          });
          var strandedActive = section.querySelector('[data-subtab][data-bciq-was-active="1"]');
          if (strandedActive && visibleSubs.length){
            delete strandedActive.dataset.bciqWasActive;
            try { visibleSubs[0].click(); } catch(e){}
          }
        }
      });
      /* A chapter with nothing left in it should not sit there as an empty heading. */
      document.querySelectorAll('.nav-chapter[data-chapter="' + group.id + '"]').forEach(function(chap){
        chap.style.display = visiblePages ? "" : "none";
      });
    });

    /* Never strand someone on a page they just hid. */
    if (activeViewHidden && typeof showView === "function"){
      try { showView("overview"); } catch(e){}
    }
  };

  /* ---- Settings UI ---- */
  window.renderTabVisibilityList = function(){
    var wrap = document.getElementById("setTabsList");
    if (!wrap) return;
    var m = hiddenMap();
    var reg = window.bciqTabRegistry();
    var hiddenCount = 0, totalCount = 0;
    var esc = function(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };

    var html = reg.map(function(group){
      var rows = group.pages.map(function(page){
        totalCount++;
        var pHidden = !!m["view:" + page.view];
        if (pHidden) hiddenCount++;
        var subRows = page.subs.map(function(sub){
          totalCount++;
          var sHidden = !!m["sub:" + page.view + ":" + sub.key];
          if (sHidden) hiddenCount++;
          return '<label class="tabvis-row tabvis-sub">' +
            '<input type="checkbox" data-tabvis-view="' + esc(page.view) + '" data-tabvis-sub="' + esc(sub.key) + '"' + (sHidden ? "" : " checked") + '>' +
            '<span>' + esc(sub.label) + '</span></label>';
        }).join("");
        return '<div class="tabvis-page">' +
          '<label class="tabvis-row">' +
            '<input type="checkbox" data-tabvis-view="' + esc(page.view) + '"' + (pHidden ? "" : " checked") + '>' +
            '<strong>' + esc(page.label) + '</strong>' +
            (page.subs.length ? '<em class="tabvis-note">' + page.subs.length + ' tab' + (page.subs.length===1?"":"s") + '</em>' : "") +
          '</label>' + subRows + '</div>';
      }).join("");
      return '<section class="tabvis-group"><h4>' + esc(group.label) + '</h4>' + rows + '</section>';
    }).join("");

    wrap.innerHTML = html || '<p style="color:var(--muted); font-size:var(--text-xs);">No tabs found.</p>';
    var badge = document.getElementById("setTabsCount");
    if (badge) badge.textContent = hiddenCount ? (hiddenCount + " of " + totalCount + " hidden") : (totalCount + " tabs");

    wrap.querySelectorAll("input[type=checkbox]").forEach(function(cb){
      cb.addEventListener("change", function(){
        var view = cb.getAttribute("data-tabvis-view");
        var sub = cb.getAttribute("data-tabvis-sub") || null;
        window.bciqSetTabHidden(view, sub, !cb.checked);
        /* Unticking a whole page greys its sub-tabs; re-render so the list reflects reality. */
        window.renderTabVisibilityList();
      });
    });
  };

  function wire(){
    var tog = document.getElementById("setTabsToggle");
    var list = document.getElementById("setTabsList");
    if (tog && list && !tog.dataset.wired){
      tog.dataset.wired = "1";
      tog.addEventListener("click", function(){
        var open = list.style.display !== "none";
        list.style.display = open ? "none" : "block";
        tog.setAttribute("aria-expanded", open ? "false" : "true");
        var chev = document.getElementById("setTabsChevron");
        if (chev) chev.style.transform = open ? "" : "rotate(90deg)";
        if (!open) window.renderTabVisibilityList();
      });
    }
    window.bciqApplyHiddenTabs();
    window.renderTabVisibilityList();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  /* index236: a teammate hiding a tab on their machine arrives here on the next sync poll. Re-apply
     on a light interval so the nav reflects the shared choice without a reload, and repaint the
     Settings list too if it happens to be open. */
  var __lastHiddenSig = "";
  setInterval(function(){
    var sig = "";
    try { sig = memStore.getItem(HIDDEN_TABS_KEY) || ""; } catch(e){}
    if (sig === __lastHiddenSig) return;
    __lastHiddenSig = sig;
    try { window.bciqApplyHiddenTabs(); } catch(e){}
    var list = document.getElementById("setTabsList");
    if (list && list.offsetParent !== null) { try { window.renderTabVisibilityList(); } catch(e){} }
  }, 5000);

  /* Re-apply whenever the settings modal is opened, and after any view switch, so the filter can
     never be silently undone by a re-render. */
  var _openSettings = window.openSettingsModal;
  if (typeof _openSettings === "function"){
    window.openSettingsModal = function(){
      var r = _openSettings.apply(this, arguments);
      try { window.renderTabVisibilityList(); } catch(e){}
      return r;
    };
  }
  var _showView = window.showView;
  if (typeof _showView === "function"){
    window.showView = function(){
      var r = _showView.apply(this, arguments);
      try { window.bciqApplyHiddenTabs(); } catch(e){}
      return r;
    };
  }
})();

