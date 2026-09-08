
(function ClawsIQ(){
  "use strict";
  var VISIT_KEY = "bciq_iq_last_visit";
  var lastVisit = null;
  try { lastVisit = localStorage.getItem(VISIT_KEY); } catch (e) {}

  function fmtMoneyish(n){ try { return fmtMoneyShort(n); } catch(e){ return "$" + Math.round(n).toLocaleString("en-US"); } }
  function todayIso(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

  function gameInfo(){
    try {
      var byIso = {};
      (typeof gamesForSeason === "function" ? gamesForSeason() : (typeof BLUECLAWS_2026_GAMES !== "undefined" ? BLUECLAWS_2026_GAMES : [])).forEach(function(g){
        var iso = (typeof gameLabelToIsoForSeason === "function") ? gameLabelToIsoForSeason(g.label, sState.season) : gameLabelToIso(g.label); if (iso && !byIso[iso]) byIso[iso] = g;
      });
      var t = todayIso();
      if (byIso[t]) return { today: true, g: byIso[t] };
      var future = Object.keys(byIso).filter(function(d){ return d > t; }).sort();
      return future.length ? { today: false, g: byIso[future[0]], date: future[0] } : null;
    } catch (e) { return null; }
  }

  function collect(){
    var out = { insights: [], since: [], brief: "", self: "" };
    try {
      var all = getAllRecords();
      var active = activeSeasonRecords();
      var k = computeKPIs();

      /* --- briefing --- */
      var bits = [];
      var gi = gameInfo();
      if (gi && gi.today) bits.push("Game day — BlueClaws vs " + (gi.g.opp || "TBD") + " at " + gi.g.time + ".");
      else if (gi) bits.push("Next home game: " + gi.g.label + " vs " + (gi.g.opp || "TBD") + ".");
      bits.push("The book stands at " + fmtMoneyish(k.totalValue) + " across " + active.length + " active partners.");
      var risk = (typeof pipelineSeasonRecords === "function" ? pipelineSeasonRecords() : []).filter(function(r){ return ["risk","lost"].indexOf(outlookOf(r)) >= 0; });
      var riskVal = risk.reduce(function(s, r){ return s + (displayValueForSeason(r) || 0); }, 0);
      if (risk.length) bits.push(risk.length + " renewals are flagged, " + fmtMoneyish(riskVal) + " on the line.");
      var openReq = (typeof loadRequests === "function" ? loadRequests() : []).filter(function(r){ return r.status === "open"; });
      if (openReq.length) bits.push(openReq.length + " request" + (openReq.length === 1 ? " is" : "s are") + " unclaimed.");
      out.brief = bits.join(" ");

      /* --- insights --- */
      var ins = out.insights;
      if (risk.length) ins.push({ tone: "red", text: "<b>" + risk.length + "</b> flagged renewal" + (risk.length === 1 ? "" : "s") + " worth <b>" + fmtMoneyish(riskVal) + "</b> — worst first in the Renewal Center", view: "renewals" });
      var lag = active.filter(function(r){ try { var p = fulfillmentPercent(r); return p !== null && p < 25; } catch(e){ return false; } });
      if (lag.length) ins.push({ tone: "gold", text: "<b>" + lag.length + "</b> active partner" + (lag.length === 1 ? "" : "s") + " under 25% fulfillment mid-season", view: "fulfillment" });
      try {
        var outstanding = getAllReportRows().filter(function(r){ return !reportCompletedFor(r, "mid") || !reportCompletedFor(r, "annual"); }).length;
        if (outstanding) ins.push({ tone: "blue", text: "<b>" + outstanding + "</b> partner report" + (outstanding === 1 ? "" : "s") + " with work outstanding", view: "digideck" });
      } catch (e) {}
      try {
        var drafts = loadOptions().filter(function(p){ return p.status === "draft"; });
        var stale = drafts.filter(function(p){ return p.createdAt && (Date.now() - Date.parse(p.createdAt)) > 14 * 86400000; });
        if (stale.length) ins.push({ tone: "gold", text: "<b>" + stale.length + "</b> proposal" + (stale.length === 1 ? "" : "s") + " sitting in draft for 14+ days", view: "options" });
      } catch (e) {}
      var noLogo = active.filter(function(r){ return !r.logoDataUrl; });
      if (noLogo.length) ins.push({ tone: "navy", text: "<b>" + noLogo.length + "</b> active partner" + (noLogo.length === 1 ? "" : "s") + " still missing a logo", view: "sponsors" });
      var noRep = active.filter(function(r){ return !r.rep; });
      if (noRep.length) ins.push({ tone: "navy", text: "<b>" + noRep.length + "</b> active account" + (noRep.length === 1 ? "" : "s") + " with no rep assigned", view: "sponsors" });
      try {
        var q = loadSyncQueue().length, dead = loadDeadLetters().length;
        if (dead) ins.push({ tone: "red", text: "<b>" + dead + "</b> change" + (dead === 1 ? "" : "s") + " the server refused — check the sync panel", view: null });
        else if (q > 3) ins.push({ tone: "gold", text: "<b>" + q + "</b> changes still queued to sync", view: null });
      } catch (e) {}

      /* --- since you were last here --- */
      var cutoff = lastVisit || new Date(Date.now() - 86400000).toISOString();
      var changed = all.filter(function(r){ return r.updatedAt && r.updatedAt > cutoff; })
        .sort(function(a, b){ return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
      out.since = changed.slice(0, 6).map(function(r){
        var what = "updated";
        try { var ch = bciqChanged(r); if (ch.length) what = ch.slice(0, 3).join(", ") + " updated"; } catch (e) {}
        return { id: r.id, name: r.sponsor, what: what, ago: (typeof bciqAgo === "function" ? bciqAgo(r.updatedAt) : "") };
      });
      out.sinceTotal = changed.length;

      /* --- user, team and app alerts --- */
      try {
        var repSet = {};
        all.forEach(function(r){ if (r.rep) repSet[r.rep] = true; if (r.service) repSet[r.service] = true; });
        try { loadReps().forEach(function(n){ if (n) repSet[n] = true; }); } catch(e) {}
        try { loadServiceReps().forEach(function(n){ if (n) repSet[n] = true; }); } catch(e) {}
        try { var cu = currentUser(); if (cu) repSet[cu] = true; } catch(e) {}
        out.people = Object.keys(repSet).sort(function(a,b){ return a.localeCompare(b); });
        out.person = (function(){ try { return localStorage.getItem("bciq_iq_person") || currentUser() || out.people[0] || ""; } catch(e){ return out.people[0] || ""; } })();
        if (out.person && out.people.indexOf(out.person) < 0) out.people.unshift(out.person);
        var mine = all.filter(function(r){ return r.rep === out.person || r.service === out.person; });
        var myReq = [], myClaimable = []; try {
          var reqs = loadRequests().filter(reqIsOpen);
          var svc = (typeof serviceTeamNames === "function" ? serviceTeamNames() : []).map(function(n){ return String(n || "").toLowerCase(); });
          var isSvc = svc.indexOf(String(out.person || "").toLowerCase()) >= 0;
          myReq = reqs.filter(function(r){ return r.owner === out.person || r.requestedBy === out.person || (r.approvals || []).some(function(a){ return a.name === out.person && a.status === "pending"; }); });
          myClaimable = isSvc ? reqs.filter(function(r){ return r.status === "requested" && !r.owner; }) : [];
        } catch(e) {}
        var myOpen = myReq.filter(function(r){ return r.owner === out.person; });
        var mySigned = mine.filter(function(r){ return dealStageOf(r) === "signed" || r.active === true; });
        var myValue = mine.reduce(function(a,r){ return a + val(r); }, 0);
        var dueSoon = mine.filter(function(r){ return r.followUpDate || r.midSeasonDueDate || r.annualDueDate; }).slice(0, 5);
        var prospects = mine.filter(function(r){ return dealStageOf(r) !== "signed" && r.active === false; }).slice(0, 4);
        out.my = { openTasks: myOpen.length + myClaimable.length, assignedTasks: myReq.slice(0, 5), claimableTasks: myClaimable.slice(0, 5), accounts: mine.length, signed: mySigned.length, value: myValue, dueSoon: dueSoon, prospects: prospects };
        var totalValue = active.reduce(function(a,r){ return a + val(r); }, 0);
        var openReq = []; try { openReq = loadRequests().filter(reqIsOpen); } catch(e) {}
        var unclaimed = openReq.filter(function(r){ return !r.owner; });
        var risk = active.filter(function(r){ var o = outlookOf(r); return o === "risk" || o === "lost"; });
        out.team = { active: active.length, value: totalValue, openRequests: openReq.length, unclaimed: unclaimed.length, risk: risk.length };
        out.app = (BUILD_NOTES || []).slice(0, 3);
      } catch(e) {
        out.people = []; out.person = ""; out.my = { openTasks:0, assignedTasks:[], claimableTasks:[], accounts:0, signed:0, value:0, dueSoon:[], prospects:[] };
        out.team = { active:active.length, value:0, openRequests:0, unclaimed:0, risk:0 };
        out.app = [];
      }

      /* --- self-awareness --- */
      var build = "";
      try { for (var i = 0; i < document.childNodes.length; i++) { var n = document.childNodes[i]; if (n.nodeType === 8) { var m = String(n.nodeValue).match(/BUILD_VERSION:\s*(\d+)/); if (m) { build = m[1]; break; } } } } catch (e) {}
      var chans = 0; try { chans = Object.keys(getWholeStoreChannels()).length; } catch (e) {}
      var nAssets = 0; try { nAssets = getFullCatalog().length; } catch (e) {}
      var syncTxt = "offline — everything saves here";
      try { var el = document.getElementById("syncStatusText"); if (el) syncTxt = el.textContent.toLowerCase(); } catch (e) {}
      /* index227: the assistant introduces itself by NAME first and build second. The build number
         is still read live from the BUILD_VERSION marker, so this line re-describes itself on every
         deploy without anyone editing a string. */
      out.self = IQ_ASSISTANT_NAME + " · build " + (build || "?") + " · watching " + all.length + " sponsors, " + nAssets + " assets, " + chans + " sync channels · " + syncTxt + " · everything above computed live from the record base just now.";
    } catch (e) { out.brief = "Still waking up — the data layer hasn't finished loading."; }
    return out;
  }

  function thoughts(d){
    var t = [];
    var gi = gameInfo();
    if (gi && gi.today) t.push("game day: vs " + (gi.g.opp || "TBD") + " · " + gi.g.time);
    d.insights.slice(0, 4).forEach(function(i){ t.push(i.text.replace(/<[^>]+>/g, "")); });
    if (d.sinceTotal) t.push(d.sinceTotal + " record" + (d.sinceTotal === 1 ? "" : "s") + " changed since your last visit");
    if (!t.length) t.push("all quiet — the book is " + (function(){ try { return fmtMoneyish(computeKPIs().totalValue); } catch(e){ return "steady"; } })());
    return t;
  }

  /* ---- render ---- */
  var panel = document.getElementById("iqPanel"), orb = document.getElementById("iqOrb");
  var data = null, thoughtIdx = 0, typeTimer = null;

  function typewrite(el, text){
    clearInterval(typeTimer);
    var reduced = false;
    try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (reduced) { el.textContent = text; return; }
    el.textContent = "";
    var i = 0;
    typeTimer = setInterval(function(){
      i += 3;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(typeTimer);
    }, 24);
  }

  function refresh(openPanel){
    data = collect();
    var badge = document.getElementById("iqOrbBadge");
    var taskN = ((data.my || {}).claimableTasks || []).length + ((data.my || {}).assignedTasks || []).length;
    var n = data.insights.length + taskN;
    if (badge) { badge.hidden = !n; badge.textContent = n; }
    document.getElementById("iqStamp").textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    renderIqAlertSections(data);
    document.getElementById("iqSelf").textContent = data.self;
    panel.querySelectorAll("[data-iq-view]").forEach(function(row){
      var v = row.dataset.iqView; if (!v) return;
      var go = function(){ try { showView(v); } catch (e) {} };
      row.addEventListener("click", go);
      row.addEventListener("keypress", function(e){ if (e.key === "Enter") go(); });
    });
    panel.querySelectorAll("[data-iq-open]").forEach(function(row){
      var go = function(){ try { openDrawer(row.dataset.iqOpen); } catch (e) {} };
      row.addEventListener("click", go);
      row.addEventListener("keypress", function(e){ if (e.key === "Enter") go(); });
    });
    panel.querySelectorAll("[data-iq-request]").forEach(function(row){
      var go = function(){
        try {
          reqState.expanded = row.dataset.iqRequest;
          reqState.status = "open";
          showView("requests");
          if (typeof renderReqChips === "function") renderReqChips();
          if (typeof renderReqRows === "function") renderReqRows();
        } catch (e) {}
      };
      row.addEventListener("click", go);
      row.addEventListener("keypress", function(e){ if (e.key === "Enter") go(); });
    });
    if (openPanel) { panel.classList.add("open"); typewrite(document.getElementById("iqBrief"), data.brief); }
  }

  function renderIqAlertSections(d){
    var sel = document.getElementById("iqPersonSelect");
    if (sel) {
      var cur = d.person || "";
      sel.innerHTML = (d.people || []).map(function(n){ return '<option value="' + esc(n) + '"' + (n === cur ? " selected" : "") + '>' + esc(n) + '</option>'; }).join("");
      if (!sel.dataset.wired) {
        sel.dataset.wired = "1";
        sel.addEventListener("change", function(){
          try { localStorage.setItem("bciq_iq_person", sel.value); } catch(e) {}
          refresh(false);
        });
      }
    }
    var my = document.getElementById("iqMyAlerts");
    if (my) {
      var m = d.my || {};
      var taskRows = (m.claimableTasks || []).map(function(r){ return '<div class="iq-row red" data-iq-request="' + esc(r.id) + '" role="button" tabindex="0"><b>Claim needed</b> ' + esc(r.sponsorName || "Request") + ' · ' + esc(((REQ_TYPES[r.type] || {}).short || r.type)) + '<span class="iq-go">&rarr;</span></div>'; }).join("")
        + (m.assignedTasks || []).map(function(r){ return '<div class="iq-row gold" data-iq-request="' + esc(r.id) + '" role="button" tabindex="0"><b>' + (r.owner === d.person ? "Assigned" : "Request") + '</b> ' + esc(r.sponsorName || "Request") + ' · ' + esc(((REQ_TYPES[r.type] || {}).short || r.type)) + '<span class="iq-go">&rarr;</span></div>'; }).join("");
      var due = (m.dueSoon || []).map(function(r){ return '<div class="iq-row gold" data-iq-open="' + esc(r.id) + '" role="button" tabindex="0"><b>' + esc(r.sponsor) + '</b> upcoming item<span class="iq-go">&rarr;</span></div>'; }).join("");
      var prospects = (m.prospects || []).map(function(r){ return '<div class="iq-row blue" data-iq-open="' + esc(r.id) + '" role="button" tabindex="0"><b>' + esc(r.sponsor) + '</b> prospecting follow-up<span class="iq-go">&rarr;</span></div>'; }).join("");
      var personalRows = taskRows + due + prospects;
      my.innerHTML =
        '<div class="iq-alert-grid"><div class="iq-alert-stat"><small>Open tasks</small><strong>' + (m.openTasks || 0) + '</strong></div><div class="iq-alert-stat"><small>Book value</small><strong>' + esc(fmtMoneyShort(m.value || 0)) + '</strong></div><div class="iq-alert-stat"><small>Accounts</small><strong>' + (m.accounts || 0) + '</strong></div><div class="iq-alert-stat"><small>Signed / active</small><strong>' + (m.signed || 0) + '</strong></div></div>'
        + '<div class="iq-alert-list">' + (personalRows || '<div class="iq-empty">No personal alerts for this person right now.</div>') + '</div>'
        + '<p class="iq-alert-note">Use this for personal tasks, rep performance, client timing, and prospecting prompts.</p>';
    }
    var team = document.getElementById("iqTeamAlerts");
    if (team) {
      var t = d.team || {};
      var rows = (d.insights || []).slice(0, 5).map(function(i){ return '<div class="iq-row ' + i.tone + '" data-iq-view="' + (i.view || "") + '" role="button" tabindex="0">' + i.text + (i.view ? '<span class="iq-go">&rarr;</span>' : "") + '</div>'; }).join("");
      team.innerHTML =
        '<div class="iq-alert-grid"><div class="iq-alert-stat"><small>Active partners</small><strong>' + (t.active || 0) + '</strong></div><div class="iq-alert-stat"><small>Signed value</small><strong>' + esc(fmtMoneyShort(t.value || 0)) + '</strong></div><div class="iq-alert-stat"><small>Open requests</small><strong>' + (t.openRequests || 0) + '</strong></div><div class="iq-alert-stat"><small>Unclaimed</small><strong>' + (t.unclaimed || 0) + '</strong></div></div>'
        + '<div class="iq-alert-list">' + (rows || '<div class="iq-empty">No team alerts right now.</div>') + '</div>';
    }
    var app = document.getElementById("iqAppAlerts");
    if (app) {
      app.innerHTML = (d.app || []).length
        ? (d.app || []).map(function(b){ return '<div class="iq-row blue"><b>Build ' + esc(b.build) + ': ' + esc(b.title) + '</b><span>' + esc((b.items || [])[0] || "") + '</span></div>'; }).join("")
        : '<div class="iq-empty">No app updates loaded.</div>';
    }
  }

  orb.addEventListener("click", function(){
    if (panel.classList.contains("open")) { panel.classList.remove("open"); return; }
    refresh(true);
  });
  document.addEventListener("click", function(e){
    if (!panel.classList.contains("open")) return;
    if (e.target.closest("#iqPanel") || e.target.closest("#iqOrb") || e.target.closest("#iqTicker")) return;
    panel.classList.remove("open");
  });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape" && panel.classList.contains("open")) panel.classList.remove("open"); });

  /* ---- ticker ---- */
  function buildTicker(){
    var bar = document.querySelector(".topbar");
    if (!bar || document.getElementById("iqTicker")) return;
    var t = document.createElement("div");
    t.id = "iqTicker";
    t.innerHTML = '<span class="iq-dot" aria-hidden="true"></span><b>CLAWS IQ</b><span id="iqTickerText"></span>';
    t.title = "Claws IQ — click for the full briefing";
    t.addEventListener("click", function(){ refresh(true); });
    bar.parentNode.insertBefore(t, bar.nextSibling);
  }
  function tickTicker(){
    var el = document.getElementById("iqTickerText");
    if (!el || document.hidden) return;
    if (!data) data = collect();
    var list = thoughts(data);
    el.style.opacity = "0";
    setTimeout(function(){
      thoughtIdx = (thoughtIdx + 1) % list.length;
      el.textContent = list[thoughtIdx];
      el.style.opacity = "1";
    }, 380);
  }
  function shouldRefreshIqData(){
    try { return (panel && panel.classList.contains("open")) || (typeof bciqLiveUpdatesEnabled === "function" && bciqLiveUpdatesEnabled()); }
    catch (e) { return false; }
  }

  function boot(){
    buildTicker();
    data = collect();
    var badge = document.getElementById("iqOrbBadge");
    if (badge && data.insights.length) { badge.hidden = false; badge.textContent = data.insights.length; }
    var el = document.getElementById("iqTickerText");
    if (el) el.textContent = thoughts(data)[0] || "";
    setInterval(tickTicker, 6500);
    setInterval(function(){ if (!document.hidden && shouldRefreshIqData()) data = collect(); }, 60000);
    /* v2026.08.07 — first visit of the day used to fling the whole Captain panel open, covering the
       right third of the Overview (the pace-to-budget band, the leaderboard, and the tail of the
       only time-series chart). Prepare its contents but leave it CLOSED; the orb's insight badge
       already asks for attention, and a click opens it. */
    var today = todayIso();
    var lastDay = (lastVisit || "").slice(0, 10);
    if (lastDay !== today) setTimeout(function(){ refresh(false); }, 1400);
    try { localStorage.setItem(VISIT_KEY, new Date().toISOString()); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ setTimeout(boot, 900); });
  else setTimeout(boot, 900);
})();

