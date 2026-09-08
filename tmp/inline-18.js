
/* ============================================================================
   index231 — CAPTAIN, the conversational layer
   Ask a question in plain English; Captain answers off the live record base.

   Deliberately NOT a language model. Every answer is computed by the same functions the pages use,
   so a number here is the same number on the page it came from, and Captain can never invent a
   sponsor, a dollar figure or a fulfilment status. When he can't answer something he says so and
   points at the page that can — which is more useful than a confident guess.
   ========================================================================= */
(function Captain(){
  "use strict";
  var NAME = (typeof IQ_ASSISTANT_NAME === "string" && IQ_ASSISTANT_NAME) || "Captain";
  var esc = function(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  function money(n){ try { return fmtMoneyShort(n); } catch(e){ return "$" + Math.round(Number(n)||0).toLocaleString("en-US"); } }
  function moneyFull(n){ try { return fmtMoney(n); } catch(e){ return money(n); } }
  function recs(){ try { return getAllRecords() || []; } catch(e){ return []; } }
  function active(){ try { return activeSeasonRecords() || []; } catch(e){ return recs().filter(function(r){ return r && r.active !== false; }); } }
  function val(r){ try { return parseTotal(r.total); } catch(e){ return 0; } }
  function pct(r){ try { var v = fulfillmentPercent(r); return v === null || v === undefined ? null : v; } catch(e){ return null; } }
  function outlook(r){ try { return outlookOf(r) || "unknown"; } catch(e){ return "unknown"; } }
  function jump(view, label){ return '<button type="button" class="cap-jump" data-cap-jump="' + esc(view) + '">' + esc(label) + ' →</button>'; }

  /* ---- answer builders: each returns {text, extra} ---- */
  function aBudget(){
    var m = (window.ORG_REVENUE_METRICS) || null;
    if (!m || !m.budget) return { text: "I don't have the org budget figures loaded, so I'd only be guessing. The Executive Overview carries them when they're present." };
    var gap = Math.max(0, Number(m.varianceToBudget) || (m.budget - m.signed));
    var p = Math.round((m.signed / m.budget) * 100);
    var pipe = Number(m.likelyPipelineRemaining) || 0;
    var t = gap > 0
      ? "We're at <b>" + p + "%</b> of budget — " + moneyFull(m.signed) + " signed against " + moneyFull(m.budget) + ". That leaves <b>" + money(gap) + "</b> to close."
      : "Budget's covered — " + moneyFull(m.signed) + " signed against " + moneyFull(m.budget) + ".";
    if (pipe > 0 && gap > 0) t += " There's " + money(pipe) + " sitting in likely pipeline, so the gap is coverable if it lands.";
    return { text: t, extra: jump("overview", "Executive Overview") };
  }
  function aRisk(){
    var rows = active().filter(function(r){ var o = outlook(r); return o === "risk" || o === "lost"; })
      .sort(function(a,b){ return val(b) - val(a); });
    if (!rows.length) return { text: "Nothing is flagged at risk or not returning right now.", extra: jump("renewals","Renewal Center") };
    var total = rows.reduce(function(a,r){ return a + val(r); }, 0);
    var top = rows.slice(0, 5).map(function(r){ return "<li><b>" + esc(r.sponsor||"—") + "</b> " + money(val(r)) + "</li>"; }).join("");
    return {
      text: "<b>" + rows.length + "</b> account" + (rows.length===1?"":"s") + " flagged at risk or not returning, worth <b>" + money(total) + "</b>. Biggest first:<ul class='cap-list'>" + top + "</ul>",
      extra: jump("renewals","Renewal Center")
    };
  }
  function aTop(){
    var rows = active().slice().sort(function(a,b){ return val(b) - val(a); }).slice(0, 5);
    if (!rows.length) return { text: "No active accounts to rank yet." };
    return {
      text: "Biggest active partners this season:<ul class='cap-list'>" + rows.map(function(r,i){
        var f = pct(r);
        return "<li>" + (i+1) + ". <b>" + esc(r.sponsor||"—") + "</b> " + money(val(r)) + (f===null?"":" · " + Math.round(f) + "% fulfilled") + "</li>";
      }).join("") + "</ul>",
      extra: jump("sponsors","Ledger")
    };
  }
  function aFulfil(){
    var rows = active().map(function(r){ return { r:r, p:pct(r) }; }).filter(function(x){ return x.p !== null; });
    if (!rows.length) return { text: "No fulfilment percentages are recorded yet, so I can't score it.", extra: jump("fulfillment","Sponsor Fulfillment") };
    var low = rows.filter(function(x){ return x.p < 50; }).sort(function(a,b){ return a.p - b.p; });
    var avg = Math.round(rows.reduce(function(a,x){ return a + x.p; }, 0) / rows.length);
    var t = "Average asset fulfilment is <b>" + avg + "%</b> across " + rows.length + " account" + (rows.length===1?"":"s") + ".";
    if (low.length) t += " <b>" + low.length + "</b> " + (low.length===1?"is":"are") + " under half done — worst is <b>" + esc(low[0].r.sponsor||"—") + "</b> at " + Math.round(low[0].p) + "%.";
    return { text: t, extra: jump("fulfillment","Sponsor Fulfillment") };
  }
  function aReports(){
    var list = (window.REPORT_CHECKLIST) || [];
    if (!list.length) return { text: "The report checklist isn't loaded.", extra: jump("digideck","Partner Reports") };
    var out = list.filter(function(x){
      var mid = String(x.mid||x.midSeason||"").toLowerCase();
      var ann = String(x.annual||"").toLowerCase();
      return !/complete|done|yes/.test(mid) || !/complete|done|yes/.test(ann);
    });
    return { text: "<b>" + out.length + "</b> of " + list.length + " partner reports still have work outstanding — mid-season or annual not done.", extra: jump("digideck","Partner Reports") };
  }
  function aStale(){
    var now = Date.now();
    var rows = active().map(function(r){
      var d = r.lastContact ? Date.parse(r.lastContact) : NaN;
      return { r:r, days: isNaN(d) ? null : Math.floor((now - d) / 86400000) };
    });
    var never = rows.filter(function(x){ return x.days === null; });
    var old = rows.filter(function(x){ return x.days !== null && x.days >= 30; }).sort(function(a,b){ return b.days - a.days; });
    if (!old.length && !never.length) return { text: "Everyone active has been contacted inside the last month.", extra: jump("sponsors","Ledger") };
    var t = "";
    if (old.length) t += "<b>" + old.length + "</b> active account" + (old.length===1?"":"s") + " haven't been touched in 30+ days. Longest: <b>" + esc(old[0].r.sponsor||"—") + "</b> at " + old[0].days + " days.";
    if (never.length) t += (t?" ":"") + "<b>" + never.length + "</b> have no last-contact date recorded at all.";
    return { text: t, extra: jump("sponsors","Ledger") };
  }
  function aChanged(){
    var rows = recs().filter(function(r){ return r && r.updatedAt; })
      .sort(function(a,b){ return String(b.updatedAt).localeCompare(String(a.updatedAt)); }).slice(0, 5);
    if (!rows.length) return { text: "Nothing's been edited yet — no change history to show.", extra: jump("history","Activity history") };
    return {
      text: "Most recent edits:<ul class='cap-list'>" + rows.map(function(r){
        var what = "updated";
        try { var ch = bciqChanged(r); if (ch && ch.length) what = ch.slice(0,3).join(", ") + " updated"; } catch(e){}
        return "<li><b>" + esc(r.sponsor||"—") + "</b> — " + esc(what) + "</li>";
      }).join("") + "</ul>",
      extra: jump("history","Activity history")
    };
  }
  function aBook(){
    var all = recs(), act = active();
    var total = act.reduce(function(a,r){ return a + val(r); }, 0);
    return { text: "The book is <b>" + all.length + "</b> accounts on file, <b>" + act.length + "</b> active this season, worth <b>" + money(total) + "</b>.", extra: jump("sponsors","Ledger") };
  }
  function aGame(){
    try {
      var games = (typeof gamesForSeason === "function" ? gamesForSeason() : ((typeof BLUECLAWS_2026_GAMES !== "undefined" && BLUECLAWS_2026_GAMES) || []));
      var today = new Date(); today.setHours(0,0,0,0);
      for (var i=0;i<games.length;i++){
        var iso = (typeof gameLabelToIsoForSeason === "function") ? gameLabelToIsoForSeason(games[i].label, sState.season) : ((typeof gameLabelToIso === "function") ? gameLabelToIso(games[i].label) : null);
        if (!iso) continue;
        var d = new Date(iso + "T00:00:00");
        if (d.getTime() === today.getTime()) return { text: "Game day — we're home to <b>" + esc(games[i].opp||"?") + "</b>" + (games[i].time ? " at " + esc(games[i].time) : "") + "." , extra: jump("gameday","Gameday") };
        if (d.getTime() > today.getTime()) return { text: "No game here today. Next home date is <b>" + esc(games[i].label||iso) + "</b> against " + esc(games[i].opp||"?") + (games[i].time ? " at " + esc(games[i].time) : "") + ".", extra: jump("schedule","Schedule") };
      }
      return { text: "No more home dates on the " + esc(sState.season || "selected") + " schedule.", extra: jump("schedule","Schedule") };
    } catch(e){ return { text: "I couldn't read the schedule seed." }; }
  }
  function aHelp(){
    return { text: "I read the live record base — the same numbers the pages show. Try me on: budget pace, who's at risk, top accounts, fulfilment, outstanding reports, who's gone quiet, what changed, or today's game." };
  }

  /* ---- intent routing. Ordered: most specific pattern wins. ---- */
  var ROUTES = [
    { re: /\b(budget|pace|target|goal|quota|how (are|r) we (doing|tracking)|left to close|to go)\b/i, fn: aBudget },
    { re: /\b(risk|at-risk|churn|not returning|losing|lose|leaving|renew)\b/i, fn: aRisk },
    { re: /\b(top|biggest|largest|best|highest)\b/i, fn: aTop },
    { re: /\b(fulfil|fulfill|installed|delivered|assets? done)\b/i, fn: aFulfil },
    { re: /\b(report|recap|digideck|annual|mid-?season)\b/i, fn: aReports },
    { re: /\b(contact|quiet|stale|touch|reach|call|follow.?up|haven'?t)\b/i, fn: aStale },
    { re: /\b(chang|recent|new|updat|edit|since)\b/i, fn: aChanged },
    { re: /\b(game|homestand|opponent|tonight|today.?s game|schedule)\b/i, fn: aGame },
    { re: /\b(book|how many|total|count|overall|summary|size)\b/i, fn: aBook },
    { re: /\b(help|what can you|who are you|how do you)\b/i, fn: aHelp }
  ];

  /* A named sponsor beats every generic route — "how's OceanFirst doing" should answer about them. */
  function sponsorLookup(q){
    var needle = q.toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
    if (needle.length < 3) return null;
    var best = null, bestLen = 0;
    recs().forEach(function(r){
      var n = String(r.sponsor||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
      if (n.length > 2 && needle.indexOf(n) !== -1 && n.length > bestLen){ best = r; bestLen = n.length; }
    });
    if (!best) return null;
    var f = pct(best), o = outlook(best);
    var bits = [];
    bits.push("<b>" + esc(best.sponsor) + "</b> is " + (best.active === false ? "inactive" : "active") + " at <b>" + moneyFull(val(best)) + "</b>.");
    if (best.rep) bits.push("Rep is " + esc(best.rep) + ".");
    if (best.type) bits.push("Type " + esc(best.type) + ".");
    if (f !== null) bits.push("Fulfilment " + Math.round(f) + "%.");
    if (o && o !== "unknown") bits.push("Renewal outlook reads " + esc(String(o).replace(/([A-Z])/g," $1").toLowerCase()) + ".");
    if (best.lastContact) bits.push("Last contact " + esc(best.lastContact) + ".");
    return { text: bits.join(" "), extra: jump("sponsors","Open in Ledger") };
  }

  function answer(q){
    var s = sponsorLookup(q);
    if (s) return s;
    for (var i=0;i<ROUTES.length;i++) if (ROUTES[i].re.test(q)) return ROUTES[i].fn();
    return { text: "I don't have a read on that one. I can only answer from what's actually in the record base — try budget pace, who's at risk, top accounts, fulfilment, outstanding reports, who's gone quiet, or name a sponsor." };
  }

  /* ---- UI ---- */
  var CHIPS = ["How are we tracking to budget?","Who's at risk?","Top accounts","Who's gone quiet?","What's outstanding?","What changed?"];
  function el(id){ return document.getElementById(id); }
  function push(role, html){
    var chat = el("iqChat"); if (!chat) return;
    var row = document.createElement("div");
    row.className = "cap-msg cap-" + role;
    row.innerHTML = (role === "cap" ? '<span class="cap-who">' + esc(NAME) + '</span>' : "") + '<div class="cap-body">' + html + "</div>";
    chat.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }
  function ask(q){
    q = String(q||"").trim();
    if (!q) return;
    push("you", esc(q));
    var a;
    try { a = answer(q); } catch(e){ a = { text: "Something went wrong reading the records for that one." }; }
    push("cap", a.text + (a.extra ? '<div class="cap-extra">' + a.extra + "</div>" : ""));
  }
  function wire(){
    var form = el("iqAskForm"), input = el("iqAskInput"), chips = el("iqChips"), chat = el("iqChat");
    if (!form || form.dataset.wired) return;
    form.dataset.wired = "1";
    form.addEventListener("submit", function(e){ e.preventDefault(); ask(input.value); input.value = ""; });
    if (chips && !chips.childNodes.length){
      CHIPS.forEach(function(c){
        var b = document.createElement("button");
        b.type = "button"; b.className = "cap-chip"; b.textContent = c;
        b.addEventListener("click", function(){ ask(c); });
        chips.appendChild(b);
      });
    }
    if (chat && !chat.childNodes.length){
      var hour = new Date().getHours();
      var greet = hour < 12 ? "Morning" : (hour < 17 ? "Afternoon" : "Evening");
      push("cap", greet + ". Ask me anything about the book — I read the same records the pages do, so I'll never make a number up. If I don't know, I'll say so.");
    }
    /* Jump links inside answers navigate the app. */
    if (chat && !chat.dataset.jumpWired){
      chat.dataset.jumpWired = "1";
      chat.addEventListener("click", function(e){
        var b = e.target.closest ? e.target.closest("[data-cap-jump]") : null;
        if (!b) return;
        var v = b.getAttribute("data-cap-jump");
        try { if (typeof showView === "function") showView(v); } catch(err){}
        var panel = el("iqPanel"); if (panel) panel.classList.remove("open");
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
  var orb = document.getElementById("iqOrb");
  if (orb) orb.addEventListener("click", function(){ setTimeout(wire, 60); });
  window.captainAsk = ask;
})();

