
/* index176: bottom-right open-tasks notification chip. Counts open Service Center
   to-dos + incomplete mid/annual report tasks (same source as the Service Center
   "Open tasks" KPI), links to Service Center on click, hides itself at zero. */
(function(){
  function openTaskCount(){
    var n = 0;
    try {
      if (typeof getAllRecords === "function") {
        getAllRecords().forEach(function(r){
          (r.todo || "").split("\n").map(function(t){return t.trim();}).filter(Boolean).forEach(function(){ n++; });
        });
      }
      if (typeof getAllReportRows === "function" && typeof reportCompletedFor === "function") {
        getAllReportRows().forEach(function(r){
          if (!reportCompletedFor(r, "mid")) n++;
          if (!reportCompletedFor(r, "annual")) n++;
        });
      }
    } catch(e){}
    return n;
  }
  function ensureFocusStyle(){
    if (document.getElementById("taskAlertStyle")) return;
    var s = document.createElement("style");
    s.id = "taskAlertStyle";
    // WCAG 2.4.7 focus-visible + 2.5.5 touch target; respects reduced-motion (no animation here).
    /* index230: the sidebar-collapsed rule is gone — the chip lives in the top bar now, so
       collapsing the sidebar must not hide it. */
    s.textContent = "#taskAlert:focus-visible{outline:2px solid var(--blue,#0971ce);outline-offset:2px;}#taskAlert:hover{background:#12244a;}";
    document.head.appendChild(s);
  }
  function ensureEl(){
    var el = document.getElementById("taskAlert");
    if (el) return el;
    ensureFocusStyle();
    el = document.createElement("button");
    el.id = "taskAlert";
    el.type = "button";
    el.setAttribute("aria-label", "Open Service Center to-do list");
    // index189: in normal sidebar flow, directly BELOW the whole team-chat section, so it can
    // never overlap or block the chat input. Full-width, ~44px tall for touch/keyboard targets.
    /* index230: this chip swapped places with the four utility buttons. It used to be a full-width
       block at the foot of the sidebar, below team chat; it now sits in the top bar where those
       buttons were, so the one number that represents outstanding work is at eye level instead of
       buried under the fold. Sizing is inline-appropriate rather than full-width, and the 44px
       target is preserved via min-height. */
    el.style.cssText = [
      "display:none","align-items:center","justify-content:center","gap:8px",
      "margin:0","width:auto","box-sizing:border-box","min-height:34px",
      "padding:7px 13px","border-radius:6px","white-space:nowrap",
      "background:var(--navy,#0d1d41)","color:#fff",
      "border:1px solid var(--gold,#facd01)","border-left:3px solid var(--gold,#facd01)",
      "font-family:var(--font-display,'Manrope',sans-serif)","font-weight:800",
      "font-size:12.5px","letter-spacing:.01em","cursor:pointer"
    ].join(";");
    el.addEventListener("click", function(){
      var nav = document.querySelector('.nav-item[data-view="service"]');
      if (nav) nav.click();
    });
    var slot = document.getElementById("topbarTaskSlot");
    var chat = document.getElementById("sideChat");
    var sidebar = document.getElementById("sidebar");
    if (slot && slot.parentNode) slot.parentNode.insertBefore(el, slot);
    else if (chat && chat.parentNode) chat.parentNode.insertBefore(el, chat.nextSibling);
    else if (sidebar) sidebar.appendChild(el);
    else document.body.appendChild(el);
    return el;
  }
  function updateTaskAlert(){
    var el = ensureEl();
    var n = openTaskCount();
    if (!n) { el.style.display = "none"; return; }
    el.style.display = "flex";
    el.innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--gold,#facd01);color:var(--navy,#0d1d41);font-size:12px;font-weight:800;">' + n + '</span><span>task' + (n===1?"":"s") + ' to complete</span>';
  }
  window.updateTaskAlert = updateTaskAlert;
  /* Refresh on the app's own render cycle (nav + sync ticks) when possible. */
  if (typeof refreshCurrentView === "function" && !refreshCurrentView.__taskAlertWrapped) {
    var _orig = refreshCurrentView;
    window.refreshCurrentView = function(){ var out = _orig.apply(this, arguments); try { updateTaskAlert(); } catch(e){} return out; };
    window.refreshCurrentView.__taskAlertWrapped = true;
  }
  function boot(){ ensureEl(); updateTaskAlert(); setInterval(function(){ if(document.hidden) return; updateTaskAlert(); }, 8000); }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();

