
  (function(){
    var DEFAULT_PASS = "BCIQ2026";
    var KEY = "bciq_site_password";
    var ID_KEY = "bciq_current_user";
    var LIVE_KEY = "bciq.liveUpdates";
    var cachedPassword = currentPassword();
    var remotePasswordPromise = null;
    function currentPassword(){
      try { return localStorage.getItem(KEY) || DEFAULT_PASS; } catch(e) { return DEFAULT_PASS; }
    }
    function syncRemotePassword(){
      if (!/^https?:$/.test(location.protocol)) return Promise.resolve(cachedPassword);
      var timeout = new Promise(function(resolve){ setTimeout(function(){ resolve(cachedPassword); }, 1600); });
      var remote = fetch("/.netlify/functions/data?bucket=overrides&id=sitePassword", { cache: "no-store" })
        .then(function(res){ return res.ok ? res.json() : null; })
        .then(function(shared){
          var remote = shared && shared.value;
          if (remote) {
            cachedPassword = String(remote);
            try { localStorage.setItem(KEY, cachedPassword); } catch(e) {}
          }
          return cachedPassword;
        })
        .catch(function(){ return cachedPassword; });
      remotePasswordPromise = Promise.race([remote, timeout]);
      return remotePasswordPromise;
    }
    function unlock(remember){
      saveIdentity();
      saveLiveMode();
      try { sessionStorage.setItem("bciq.site.auth", "ok"); } catch(e) {}
      if (remember) { try { localStorage.setItem("bciq.site.auth", "ok"); } catch(e) {} }
      document.documentElement.classList.remove("bciq-locked");
      document.documentElement.classList.add("bciq-unlocked");
      try { window.dispatchEvent(new Event("bciq-unlocked")); } catch(e) {}
    }
    function saveIdentity(){
      var sel = document.getElementById("bciqLoginPerson");
      var name = sel && sel.value || "";
      name = String(name || "").trim();
      if (name) { try { localStorage.setItem(ID_KEY, name); } catch(e) {} }
    }
    function initIdentity(){
      var sel = document.getElementById("bciqLoginPerson");
      if (!sel) return;
      var saved = "";
      try { saved = localStorage.getItem(ID_KEY) || ""; } catch(e) {}
      if (saved) sel.value = saved;
    }
    function saveLiveMode(){
      var mode = document.getElementById("bciqLiveMode");
      var live = mode && mode.value === "live";
      try { sessionStorage.setItem(LIVE_KEY, live ? "1" : "0"); } catch(e) {}
    }
    function initLiveMode(){
      var mode = document.getElementById("bciqLiveMode");
      if (!mode) return;
      try { mode.value = sessionStorage.getItem(LIVE_KEY) === "1" ? "live" : "quiet"; } catch(e) { mode.value = "quiet"; }
    }
    function init(){
      if (document.documentElement.classList.contains("bciq-unlocked")) return;
      var form = document.getElementById("bciqPasswordForm");
      var input = document.getElementById("bciqPasswordInput");
      var remember = document.getElementById("bciqRememberBrowser");
      var error = document.getElementById("bciqPasswordError");
      if (!form || !input) return;
      initIdentity();
      initLiveMode();
      setTimeout(function(){ try { input.focus(); } catch(e) {} }, 40);
      syncRemotePassword();
      form.addEventListener("submit", function(e){
        e.preventDefault();
        if (input.value === (cachedPassword || currentPassword())) { unlock(!remember || remember.checked); return; }
        var check = remotePasswordPromise || Promise.resolve(cachedPassword || currentPassword());
        check.then(function(pass){
          if (input.value === pass) { unlock(!remember || remember.checked); }
          else {
            if (error) error.textContent = "Incorrect password. Please try again.";
            input.select();
          }
        });
      });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  })();
  
