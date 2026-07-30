/* ═══════════════════════════════════════════════════════════
   Yūki's Sacred Space — interactions
   vanilla, no dependencies
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── year ─────────────────────────────────────────────── */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ── nav: stuck state ─────────────────────────────────── */
  var nav = document.getElementById('nav');
  function onScroll() {
    nav.classList.toggle('is-stuck', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── nav: mobile menu ─────────────────────────────────── */
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('navMenu');

  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* ── reveal on scroll ─────────────────────────────────── */
  var items = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || reduced) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ── spiders ───────────────────────────────────────────── */
  /* Each one picks a random spot along the top, drops fast, hangs a few
     seconds, then climbs back up off screen and waits before going again. */
  var spiders = Array.prototype.slice.call(document.querySelectorAll('.spider'));

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  /* Spider travel speed in px/ms — the single knob for how fast they move.
     Lower is slower. Drop was effectively 0.515 px/ms before this was made
     explicit. */
  var DROP_SPEED = 0.13;
  var RISE_SPEED = 0.10;

  if (spiders.length && !reduced) {
    spiders.forEach(function (el, i) {
      var thread = el.querySelector('.spider__thread');
      var body = el.querySelector('.spider__body');

      function setPose(t, ms, easing) {
        var drop = parseFloat(el.style.getPropertyValue('--max')) || 300;
        thread.style.transition = 'transform ' + ms + 'ms ' + easing;
        body.style.transition = 'transform ' + ms + 'ms ' + easing;
        thread.style.transform = 'scaleY(' + t + ')';
        body.style.transform = 'translateY(' + (drop * t) + 'px)';
      }

      // keep them out toward the edges: middle third only ~10% of the time
      function pickLeft() {
        var r = Math.random();
        if (r < 0.10) return rand(34, 66);   // middle third
        if (r < 0.55) return rand(5, 33);    // left third
        return rand(67, 95);                 // right third
      }

      function cycle() {
        // new spot and new drop depth every time
        el.style.left = pickLeft().toFixed(2) + '%';
        var depth = Math.min(rand(340, 1040), window.innerHeight * 0.85);
        el.style.setProperty('--max', Math.round(depth) + 'px');
        thread.style.height = Math.round(depth) + 'px';

        // Duration is derived from distance, not drawn independently — pick a
        // random duration and a random depth and the two cancel out, leaving
        // the apparent speed unchanged no matter what you set.
        var dropMs = clamp(depth / (DROP_SPEED * rand(0.85, 1.15)), 1800, 7000);
        var riseMs = clamp(depth / (RISE_SPEED * rand(0.85, 1.15)), 2400, 9000);
        var holdMs = rand(2600, 5600);
        var restMs = rand(2500, 8000);

        // land the new position/height before animating out of it
        setPose(0, 0, 'linear');

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            // gentle decel — a front-loaded curve reads as a fast burst even
            // over a long duration
            setPose(1, dropMs, 'cubic-bezier(.25,.55,.4,1)');
          });
        });

        setTimeout(function () {
          setPose(0, riseMs, 'cubic-bezier(.45,.05,.55,.95)');   // climb back
          setTimeout(cycle, riseMs + restMs);
        }, dropMs + holdMs);
      }

      setTimeout(cycle, i * 2600 + rand(400, 3200));
    });
  }

  /* ── kanji watermark drift ────────────────────────────── */
  /* fixed element, so a little scroll-linked travel keeps it from feeling
     pasted on: ~120px across the whole page */
  var kanji = document.querySelector('.kanji span');

  if (kanji && !reduced) {
    var kTicking = false;

    function driftKanji() {
      var vh = window.innerHeight;
      var max = document.documentElement.scrollHeight - vh;
      var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      var over = kanji.offsetHeight - vh;
      var y;

      if (over > 0) {
        // taller than the screen: travel the overflow across the page scroll,
        // so the phrase starts at 未 and ends on に by the footer
        y = -p * over;
      } else {
        // short enough to fit — centre it and drift gently, never past the
        // free space or the top character clips
        var slack = (vh - kanji.offsetHeight) / 2;
        y = slack + (p - 0.5) * 2 * Math.max(0, Math.min(60, slack - 8));
      }

      kanji.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      kTicking = false;
    }
    window.addEventListener('resize', driftKanji);

    window.addEventListener('scroll', function () {
      if (!kTicking) { kTicking = true; requestAnimationFrame(driftKanji); }
    }, { passive: true });
    driftKanji();
  }

  /* ── ambient aura canvas ──────────────────────────────── */
  var canvas = document.getElementById('aura');
  if (!canvas || reduced) return;

  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, dpr = 1;
  var stars = [];
  var blobs = [];
  var t = 0;
  var raf = null;

  var PALETTE = [
    [138, 70, 112],  // plum
    [176, 74, 74],   // ember
    [212, 169, 74],  // gold
    [70, 52, 96]     // deep violet
  ];

  function seed() {
    // starfield scales with viewport, capped so phones stay cheap
    var count = Math.min(140, Math.round((w * h) / 16000));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.25,
        a: Math.random() * 0.5 + 0.12,
        // twinkle speed & phase
        s: Math.random() * 0.9 + 0.25,
        p: Math.random() * Math.PI * 2
      });
    }

    blobs = [];
    for (var j = 0; j < 4; j++) {
      var c = PALETTE[j % PALETTE.length];
      blobs.push({
        c: c,
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 0.28 + 0.30,
        // slow independent drift
        dx: (Math.random() - 0.5) * 0.055,
        dy: (Math.random() - 0.5) * 0.045,
        px: Math.random() * Math.PI * 2,
        py: Math.random() * Math.PI * 2,
        o: Math.random() * 0.05 + 0.075
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function draw() {
    t += 0.0038;
    ctx.clearRect(0, 0, w, h);

    // drifting colour fields
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var bx = (b.x + Math.sin(t * b.dx * 12 + b.px) * 0.18) * w;
      var by = (b.y + Math.cos(t * b.dy * 12 + b.py) * 0.15) * h;
      var br = b.r * Math.max(w, h);

      var g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, 'rgba(' + b.c[0] + ',' + b.c[1] + ',' + b.c[2] + ',' + b.o + ')');
      g.addColorStop(1, 'rgba(' + b.c[0] + ',' + b.c[1] + ',' + b.c[2] + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }

    // stars
    ctx.globalCompositeOperation = 'source-over';
    for (var k = 0; k < stars.length; k++) {
      var s = stars[k];
      var tw = s.a * (0.55 + 0.45 * Math.sin(t * 9 * s.s + s.p));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,230,224,' + tw.toFixed(3) + ')';
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  function start() {
    if (raf === null) raf = requestAnimationFrame(draw);
  }
  function stop() {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // don't burn battery in a background tab
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : start();
  });

  resize();
  start();
})();
