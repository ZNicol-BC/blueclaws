
/* index230: the utility dock is authored inside <header class="topbar"> so that every existing
   getElementById binding for backupBtn / historyBtn / sitemapBtn / settingsBtn resolves at script
   time. But .topbar is position:sticky, which creates a stacking context — a position:fixed child
   of it is trapped at the header's own z-index and ends up painted UNDER page content, making the
   buttons unclickable. Re-parenting it to <body> after load frees it from that stacking context.
   Moving a node preserves its event listeners, so nothing needs re-binding. */
(function(){
  /* index231: re-parented into the SIDEBAR, into the exact slot the tasks bar vacated when that
     moved up to the top bar — a true swap of the two clusters, and it fills what was otherwise a
     dead gap under Team Chat. Falls back to <body> only if the sidebar isn't there. */
  function dockToSidebar(){
    var d = document.getElementById("utilityDock");
    if (!d) return;
    var chat = document.getElementById("sideChat");
    var sidebar = document.getElementById("sidebar");
    if (chat && chat.parentNode) {
      if (d.previousElementSibling !== chat) chat.parentNode.insertBefore(d, chat.nextSibling);
    } else if (sidebar) {
      if (d.parentNode !== sidebar) sidebar.appendChild(d);
    } else if (d.parentNode !== document.body) {
      document.body.appendChild(d);
    }
  }
  /* index231: Favourite Actions / Customize is a personalisation control, not a place you navigate
     to — it was sitting between quick search and the Workspace list, pushing the actual nav down.
     It moves to the very bottom of the sidebar, under the utility buttons, and shrinks (see CSS).
     Same re-parent approach as the dock: listeners survive the move, nothing re-binds. */
  function favouritesToFoot(){
    var fav = document.getElementById("favoriteActionsWrap");
    var sidebar = document.getElementById("sidebar");
    if (!fav || !sidebar) return;
    fav.classList.remove("fav-compact");
  }
  function arrangeSidebar(){ dockToSidebar(); favouritesToFoot(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrangeSidebar);
  else arrangeSidebar();
})();

