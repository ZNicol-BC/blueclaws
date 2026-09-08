
/* ════════════════════════════════════════════════════════════════
   DZ — THE DIMENSION SCALE, runtime v1 (2026-08-08)
   Pairs with dz.css. No dependencies, no network, transforms only.
   API:  DZ.on() / DZ.off() / DZ.toggle() / DZ.arm()
   Elements opt in via data-3d="lift|press|tilt|glare|drift|rise|
   flip|spin|spin-hover|sway|turntable" (space-separated).
   ════════════════════════════════════════════════════════════════ */
window.DZ = (function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stored = null;
  try { stored = localStorage.getItem('dz.mode'); } catch (e) {}
  root.setAttribute('data-dz', stored || (reduced ? 'off' : 'on'));

  function off() { return root.getAttribute('data-dz') === 'off'; }

  /* ---- D2 · tilt, one delegated listener, rAF-throttled ---- */
  var tiltEl = null, raf = 0, px = 0, py = 0;
  function findTilt(e) {
    return e.target && e.target.closest ? e.target.closest('[data-3d~="tilt"]') : null;
  }
  function resetTilt(t) {
    t.classList.remove('dz-tilting');
    t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg');
    t.style.setProperty('--tz', '0px'); t.style.setProperty('--go', 0);
  }
  doc.addEventListener('pointermove', function (e) {
    if (off()) return;
    var t = findTilt(e);
    if (t !== tiltEl) { if (tiltEl) resetTilt(tiltEl); tiltEl = t; if (t) t.classList.add('dz-tilting'); }
    if (!t) return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(applyTilt);
  }, { passive: true });
  function applyTilt() {
    raf = 0;
    var t = tiltEl; if (!t) return;
    var r = t.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var mx = (px - r.left) / r.width - .5;
    var my = (py - r.top) / r.height - .5;
    var max = parseFloat(getComputedStyle(t).getPropertyValue('--dz-tilt-max')) || 7;
    t.style.setProperty('--ry', (mx * 2 * max).toFixed(2) + 'deg');
    t.style.setProperty('--rx', (-my * 2 * max).toFixed(2) + 'deg');
    t.style.setProperty('--tz', 'var(--dz-pop)');
    t.style.setProperty('--gx', ((mx + .5) * 100).toFixed(1) + '%');
    t.style.setProperty('--gy', ((my + .5) * 100).toFixed(1) + '%');
    t.style.setProperty('--go', .9);
  }
  doc.addEventListener('pointerout', function (e) {
    if (tiltEl && !tiltEl.contains(e.relatedTarget)) { resetTilt(tiltEl); tiltEl = null; }
  }, true);

  /* ---- D3 · rise (IntersectionObserver) + drift (scroll) ---- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('dz-in'); io.unobserve(x.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: .01 });

  var driftEls = [], turnEls = [];
  function arm() {
    doc.querySelectorAll('[data-3d~="rise"]:not(.dz-armed)').forEach(function (el) {
      el.classList.add('dz-armed'); io.observe(el);
    });
    driftEls = Array.prototype.slice.call(doc.querySelectorAll('[data-3d~="drift"]'));
    turnEls = Array.prototype.slice.call(doc.querySelectorAll('[data-3d~="turntable"]'));
  }
  var sraf = 0;
  function onScroll() {
    if (sraf || off()) return;
    sraf = requestAnimationFrame(function () {
      sraf = 0;
      var vh = innerHeight;
      driftEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        var c = (r.top + r.height / 2 - vh / 2) / vh;      /* ≈ -0.5 … 0.5 */
        var depth = parseFloat(el.dataset.depth || 1);
        el.style.setProperty('--dy', (-c * depth * 18).toFixed(1) + 'px');
      });
      /* D5 camera: scenes read scroll progress into --dz-cam */
      doc.querySelectorAll('.dz-scene').forEach(function (sc) {
        var r = sc.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
        sc.style.setProperty('--dz-cam', (30 + p * 40).toFixed(1) + '%');
      });
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  /* ---- D4 · flip (click) ---- */
  doc.addEventListener('click', function (e) {
    var f = e.target && e.target.closest ? e.target.closest('.dz-flip[data-3d~="flip"]') : null;
    if (f && !e.target.closest('a,button,input,select,textarea')) f.classList.toggle('dz-flipped');
  });

  /* ---- D4 · sprite turntable: JS-stepped for exact frame math ---- */
  var last = 0;
  function turn(ts) {
    if (!off() && turnEls.length && ts - last > 90) {   /* ~11fps steps read as model turn */
      last = ts;
      turnEls.forEach(function (el) {
        var n = parseInt(el.dataset.frames || 36, 10);
        var f = (parseInt(el.dataset.f || 0, 10) + 1) % n;
        el.dataset.f = f;
        el.style.backgroundPositionX = (f * 100 / (n - 1)) + '%';
      });
    }
    requestAnimationFrame(turn);
  }
  requestAnimationFrame(turn);

  /* re-arm when the page redraws itself */
  var armT = 0;
  new MutationObserver(function () { clearTimeout(armT); armT = setTimeout(arm, 90); })
    .observe(root, { childList: true, subtree: true });

  /* master toggle chip (skip if the page provides its own) */
  function makeToggle() {
    return;
    if (doc.querySelector('.dz-toggle')) return;
    var b = doc.createElement('button');
    b.type = 'button'; b.className = 'dz-toggle';
    b.setAttribute('aria-pressed', String(!off()));
    b.textContent = '3-D ' + (off() ? 'off' : 'on');
    b.onclick = function () {
      api.toggle();
      b.textContent = '3-D ' + (off() ? 'off' : 'on');
      b.setAttribute('aria-pressed', String(!off()));
    };
    doc.body.appendChild(b);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { arm(); onScroll(); makeToggle(); });
  else { arm(); onScroll(); makeToggle(); }

  var api = {
    on:  function () { root.setAttribute('data-dz', 'on');  try { localStorage.setItem('dz.mode', 'on'); } catch (e) {} },
    off: function () { root.setAttribute('data-dz', 'off'); try { localStorage.setItem('dz.mode', 'off'); } catch (e) {} },
    toggle: function () { (off() ? api.on : api.off)(); },
    arm: arm
  };
  return api;
})();


