
/* index257 — SEATING CHART vs SCHEMATIC.
   The chart supplied by BlueClaws management is the base artwork again. The drawn schematic
   index256 introduced is kept as an alternate, because it is the only version that obeys the
   palette (the photo chart has real green grass in it) and it prints cleanly. The choice is
   remembered per browser. Both are the same 1200x882 canvas, so the hit zones do not move. */
(function () {
  var KEY = "bciq_stadium_base_art";
  function apply(mode) {
    var img = document.getElementById("smPhotoImg");
    var sch = document.getElementById("smSchematic");
    var btn = document.getElementById("smBaseToggle");
    if (!img || !sch) return;
    var schematic = mode === "schematic";
    img.style.display = schematic ? "none" : "";
    sch.style.display = schematic ? "" : "none";
    if (btn) { btn.textContent = schematic ? "Seating chart" : "Schematic"; btn.setAttribute("aria-pressed", schematic ? "true" : "false"); }
  }
  function init() {
    var btn = document.getElementById("smBaseToggle");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    var saved = "chart";
    try { saved = localStorage.getItem(KEY) || "chart"; } catch (e) {}
    apply(saved);
    btn.addEventListener("click", function () {
      var next = (document.getElementById("smSchematic") || {}).style && document.getElementById("smSchematic").style.display === "none" ? "schematic" : "chart";
      try { localStorage.setItem(KEY, next); } catch (e) {}
      apply(next);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  setTimeout(init, 1500);
})();

