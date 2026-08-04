/* Mailing-list signup. Progressive: any form with [data-subscribe] is wired
   up, so the same markup works on the home page and the resources page.

   Kept out of main.js so a backend outage can't take the rest of the page's
   behaviour with it. */
(function () {
  'use strict';

  var forms = document.querySelectorAll('[data-subscribe]');
  if (!forms.length) return;

  Array.prototype.forEach.call(forms, function (form) {
    var msg = form.parentNode.querySelector('[data-subscribe-msg]');
    var btn = form.querySelector('button[type=submit]');

    function say(text, ok) {
      if (!msg) return;
      msg.textContent = text;
      msg.className = 'signup__msg' + (ok ? ' signup__msg--ok' : ' signup__msg--bad');
      msg.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[name=email]').value.trim();

      if (!email || email.indexOf('@') < 1) {
        return say('that doesn’t look like an email address', false);
      }

      btn.disabled = true;
      var original = btn.textContent;
      btn.textContent = 'one moment…';

      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: email,
          website: form.querySelector('input[name=website]').value,  // honeypot
          source: form.getAttribute('data-source') || 'website',
        }),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) return say(res.d.error || 'something went wrong — try again?', false);

          form.reset();
          if (res.d.alreadySubscribed) {
            say('you’re already on the list — nothing more to do 🖤', true);
          } else if (res.d.mailConfigured === false) {
            // Honest rather than pretending an email is on its way.
            say('you’re on the list 🖤', true);
          } else {
            say('check your email — there’s a link to confirm, and then you’re on the list 🖤', true);
          }
        })
        .catch(function () { say('couldn’t reach the server — try again in a minute?', false); })
        .then(function () {
          btn.disabled = false;
          btn.textContent = original;
        });
    });
  });
})();
