
(function(){
  try {
    if (sessionStorage.getItem("bciq.liveUpdates") !== "1") sessionStorage.setItem("bciq.liveUpdates", "0");
    document.documentElement.classList.add((sessionStorage.getItem("bciq.site.auth") === "ok" || localStorage.getItem("bciq.site.auth") === "ok") ? "bciq-unlocked" : "bciq-locked");
  } catch (e) {
    document.documentElement.classList.add("bciq-locked");
  }
})();

