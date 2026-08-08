/* Pageview + event beacon.

   Kept separate from the other scripts so an analytics failure can never take
   the site's actual behaviour down with it. Every call is fire-and-forget:
   nothing here blocks a page, a click, or a booking.

   No cookies are set and no identifier is stored on the device. The server
   counts unique visitors from a daily-rotating irreversible hash — see
   backend/routes/analytics.js. */
(function () {
  'use strict';

  // If someone has asked not to be tracked, don't even send the request.
  // The server honours these too; checking here just saves the round trip.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl) {
    return;
  }

  function send(url, payload) {
    try {
      var body = JSON.stringify(payload);
      // sendBeacon survives the page being unloaded, which matters for the
      // click events — a normal fetch gets cancelled mid-navigation.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        credentials: 'same-origin',
      }).catch(function () {});
    } catch (e) { /* analytics must never throw into the page */ }
  }

  function event(name, detail) {
    send('/api/event', { name: name, detail: detail || null });
  }

  /* ── pageview ─────────────────────────────────────────────── */

  send('/api/hit', {
    path: location.pathname + (location.search || ''),
    ref: document.referrer || null,
  });

  /* ── the events that actually matter ──────────────────────── */

  // Anything heading to Square is an attempt to book. This is the number
  // worth watching: visits without book clicks means the site is being read
  // but not persuading.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    if (href.indexOf('square.site') > -1 || href.indexOf('squareup.com') > -1) {
      event('book_click', a.id === 'fabBook' ? 'floating button' : 'in-page link');
    } else if (href.indexOf('guides/') > -1) {
      event('guide_open', href.replace(/^\/+/, '').split('?')[0]);
    } else if (href.indexOf('facebook.com') > -1) {
      event('message_click', null);
    }
  }, true);

  // subscribe.js fires this once the server has accepted a signup.
  document.addEventListener('yuki:subscribed', function (e) {
    event('signup', (e.detail && e.detail.source) || null);
  });

  // Printer-friendly view of a workbook — a strong signal someone intends to
  // actually use it rather than skim it.
  if (/[?&]print/.test(location.search)) {
    event('print_view', location.pathname);
  }
})();
