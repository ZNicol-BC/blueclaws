
/* ══════════════════════════════════════════════════════════════════════
   DZ ADAPTER — which surfaces of BlueClaws IQ opt in, and why.

   Almost every list in this app is re-rendered by JS on a sync tick, so the
   attributes are applied by a MutationObserver rather than written into the
   markup. Chosen per the scale's own discipline (Step 3), not sprayed:

   D1 LIFT/PRESS — anything clickable. Cards, rows, nav items, board tiles,
      pills, the buttons. This is the tier that carries the whole app.
   D2 TILT/GLARE — imagery ONLY. Sponsor logos and board artwork, which are
      ornament. Deliberately NOT on charts, tables, KPI numbers or the photo
      grid: data does not move, and the photo tiles are drag sources whose
      grab must stay predictable after a full day spent fixing it.
   D3 DRIFT — the six ambient wave bands that already sit behind the shell
      as decoration. They are the one genuinely ornamental layer in the file,
      which is exactly what parallax is for. Depths alternate so the stack
      separates instead of moving as one sheet.
   D3 RISE — only the static view heroes. Every other block re-renders on a
      poll, and a rise on re-rendered content re-fires its entrance each time,
      which reads as flashing. Skipped there on purpose.
   D4 OBJECT — two, both ornament: the sidebar wordmark turns on hover, and
      the ShoreTown roundel on the Stadium Map sways. The board grid and the
      KPI tiles were considered and rejected — they are data.
   D5 SCENE — not used. The scale says skip when unsure; a scroll-linked
      camera across 33 re-rendering views is a real overflow risk for one
      moment of depth, and Step 4's 0-overflow rule is non-negotiable.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var MAP = [
    /* --- D1: clickable surfaces --- */
    ['.kpi-card',                         'lift press', null],
    ['.glance-card',                      'lift press', null],
    ['.signing-row',                      'lift press', null],
    ['.status-partner-pill',              'lift press', null],
    ['.utb-board',                        'lift press', null],
    ['.nav-item',                         'lift press', null],
    ['.photo-check-row',                  'lift',       null],
    ['.section-display-card',             'lift press', null],
    ['.display-slot',                     'lift press', null],
    ['.utg-block',                        'lift press', null],
    ['.segment-card',                     'lift',       null],
    ['.sm-parkwide-list button',          'lift press', null],
    ['.asset-photo-thumb',                'lift press', null],
    ['.recent-strip-item',                'lift press', null],
    ['.primary-button, .secondary-button','press',      null],
    /* --- D2: ornament imagery only --- */
    ['.display-owner img',                'tilt glare', null],
    ['.section-logo-chip',                'tilt glare', null],
    ['.upper-board-photo',                'tilt glare', null],
    /* --- D3 DRIFT: now live, on the Executive Brief only (index254) ---
       The index256 run left this tier at zero and the reasoning was right: the six ambient
       wave bands are the only ornament in the shell, their container is `.ambient { position:
       fixed }` so their rects never change on scroll, and they already own `transform` through
       the waveDrift keyframes. A scroll-derived offset on them is a no-op fighting a live
       animation. What was missing was not a better target in the shell — it was a PAGE THAT
       SCROLLS AS A DOCUMENT. Every other view is a grid that fits or a list that virtualises;
       the Brief is one long column read top to bottom, which is the only context where
       parallax means anything. Its decals (the ghost season numeral, the wave rule) are
       genuinely decorative, genuinely scrolling, and carry no data, so they take drift at
       opposing depths (+3 / -2) and separate as the page moves. They are written into the
       Brief's own markup by renderBriefView rather than listed here, because they only exist
       while that view is rendered.

       --- D5 SCENE: also now live, also the Brief, and still exactly one ---
       index256 skipped D5 for a good reason — a scroll-linked camera across 33 re-rendering
       views is an overflow risk for one moment of depth. That objection is about the SHELL.
       Scoped to a single self-contained hook block, inside a wrap that clips, with children
       pushed to negative Z only, the risk is bounded and testable. Verified at all three
       widths. The scale allows one per site; this is it.

       --- the original note, kept because the reasoning still holds for the shell --- */
    /* --- D3 DRIFT: DELIBERATELY UNUSED IN THE APP SHELL ---
       The obvious targets were the six ambient wave bands, and they are the wrong ones twice
       over. Their container is `.ambient { position: fixed }`, so their bounding rects never
       change as the page scrolls and a parallax offset computed from scroll position is a
       no-op on them. They also already own `transform` through the waveDrift keyframes, which
       beats a plain rule during playback — so drift would have been a dead tier fighting a
       live animation. Nothing else in this file is both decorative and scrolling; the one
       ornamental layer it has is fixed on purpose. Shipping a tier that does nothing is worse
       than leaving it out, so D3 here is rise only. */
    /* --- D4: two ornamental objects --- */
    ['.js-wordmark',                      'spin-hover', null],
    ['#smSchematic circle[r="44"]',       'sway',       null]
  ];
  var t = 0;
  function mark() {
    MAP.forEach(function (m) {
      var nodes;
      try { nodes = document.querySelectorAll(m[0]); } catch (e) { return; }
      nodes.forEach(function (el) {
        if (!el.hasAttribute('data-3d')) {
          el.setAttribute('data-3d', m[1]);
          if (m[2]) el.setAttribute('data-depth', m[2]);
        }
      });
    });
    /* Static heroes only — see the note on RISE above. */
    document.querySelectorAll('.overview-hero').forEach(function (el) {
      if (!el.hasAttribute('data-3d')) el.setAttribute('data-3d', 'rise');
    });
    if (window.DZ) DZ.arm();
  }
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(mark, 120); })
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark);
  else mark();
})();

