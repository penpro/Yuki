/* Floating CTAs and the signup modal.

   Behaviour decisions worth keeping:

   * Booking is never blocked. The book button is a real <a> with a real
     href — it opens Square immediately, with no JS in the way. The signup
     modal appears afterwards in the tab they left behind, filling dead time
     rather than standing between someone and a purchase.

   * The buttons hide whenever a real in-page CTA is on screen. A floating
     button duplicating one the visitor can already see is just clutter.

   * A dismissal is remembered for 30 days, and someone who has signed up is
     never asked again. Re-prompting a person who already said no is the
     fastest way to make them leave. */
(function () {
  'use strict';

  var fab = document.getElementById('fab');
  var modal = document.getElementById('signupModal');
  if (!fab || !modal) return;

  var STORE = {
    done: 'yuki.signup.done',
    dismissedAt: 'yuki.signup.dismissedAt',
  };
  var DISMISS_DAYS = 30;

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function mayAsk() {
    if (read(STORE.done)) return false;
    var at = Number(read(STORE.dismissedAt) || 0);
    if (!at) return true;
    return (Date.now() - at) > DISMISS_DAYS * 864e5;
  }

  /* ── modal ────────────────────────────────────────────────── */

  var lastFocus = null;
  var COPY = {
    default: {
      kicker: 'free',
      title: 'want the free guides?',
      sub: 'breathing, meditation, and workbooks for when your head won’t stop. '
         + 'plus a note when there’s something new. one click to leave, whenever you like.',
    },
    booking: {
      kicker: 'while you’re booking',
      title: 'want the free guides too?',
      sub: 'your booking’s opening in the other tab. while you’re there — '
         + 'the breathing and CBT workbooks are free, and i’ll send a note when i add one.',
    },
  };

  function openModal(variant) {
    if (!modal.showModal) return;              // very old browser: skip silently
    var c = COPY[variant] || COPY.default;
    document.getElementById('modalKicker').textContent = c.kicker;
    document.getElementById('modalTitle').textContent = c.title;
    document.getElementById('modalSub').textContent = c.sub;

    lastFocus = document.activeElement;
    modal.showModal();                          // native focus trap + Escape
    var input = modal.querySelector('input[name=email]');
    if (input) setTimeout(function () { input.focus(); }, 60);
  }

  function closeModal(remember) {
    if (remember) write(STORE.dismissedAt, String(Date.now()));
    if (modal.open) modal.close();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.getElementById('modalClose').addEventListener('click', function () { closeModal(true); });
  document.getElementById('modalDismiss').addEventListener('click', function () { closeModal(true); });

  // Escape fires the dialog's own close event; treat it as a dismissal too.
  modal.addEventListener('close', function () { write(STORE.dismissedAt, String(Date.now())); });

  // Click on the backdrop (i.e. the dialog element itself, outside .modal__inner)
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal(true);
  });

  // subscribe.js fires this on a successful signup.
  document.addEventListener('yuki:subscribed', function () {
    write(STORE.done, '1');
    if (modal.open) setTimeout(function () { closeModal(false); }, 2200);
  });

  /* ── floating buttons ─────────────────────────────────────── */

  document.getElementById('fabSignup').addEventListener('click', function () {
    openModal('default');
  });

  // The href does the navigating. This only queues the follow-up prompt.
  document.getElementById('fabBook').addEventListener('click', function () {
    if (!mayAsk()) return;
    setTimeout(function () { openModal('booking'); }, 1200);
  });

  // Same treatment for every other book link on the page, so the prompt is
  // consistent wherever they start from.
  Array.prototype.forEach.call(
    document.querySelectorAll('a[href*="square.site"]'),
    function (a) {
      a.addEventListener('click', function () {
        if (!mayAsk()) return;
        setTimeout(function () { openModal('booking'); }, 1200);
      });
    }
  );

  /* ── when to show the buttons ─────────────────────────────── */

  // Blocks whose presence on screen should suppress the floating pair.
  var watched = ['#signup', '#reach', '.hero__cta', '.foot'].reduce(function (acc, sel) {
    return acc.concat(Array.prototype.slice.call(document.querySelectorAll(sel)));
  }, []);

  // Measured live rather than cached from an IntersectionObserver. An
  // observer only reports when it fires, and it does NOT fire while the
  // document is hidden — so a page opened in a background tab could keep a
  // stale "a CTA is visible" state forever and never show the buttons.
  // Four getBoundingClientRect calls inside an rAF-throttled scroll handler
  // costs nothing and cannot go stale.
  function ctaOnScreen() {
    var vh = window.innerHeight;
    for (var i = 0; i < watched.length; i++) {
      var r = watched[i].getBoundingClientRect();
      if (!r.height) continue;
      var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (visible / r.height >= 0.15) return true;
    }
    return false;
  }

  function update() {
    var pastHero = window.scrollY > window.innerHeight * 0.75;
    fab.hidden = false;
    fab.classList.toggle('is-in', pastHero && !ctaOnScreen());
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { update(); ticking = false; });
  }, { passive: true });

  update();

  /* ── exit intent, desktop only ────────────────────────────── */
  // Pointer leaving the top of the window is the closest thing to "about to
  // close the tab". Meaningless on touch, so it's gated on a fine pointer.
  if (window.matchMedia('(pointer:fine)').matches) {
    var armed = false;
    setTimeout(function () { armed = true; }, 12000);   // don't ambush on arrival
    document.addEventListener('mouseout', function (e) {
      if (!armed || modal.open || !mayAsk()) return;
      if (e.clientY <= 0 && !e.relatedTarget) {
        armed = false;
        openModal('default');
      }
    });
  }
})();
