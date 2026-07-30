'use strict';

(function () {
  var form = document.getElementById('loginForm');
  var err = document.getElementById('error');
  var btn = document.getElementById('submit');

  // Make the HTTP problem visible rather than trusting anyone to remember it.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1') {
    document.getElementById('insecure').hidden = false;
  }

  function fail(msg) {
    err.textContent = msg;
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = 'sign in';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = 'signing in…';

    fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      }),
    })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      })
      .then(function (res) {
        if (!res.ok) return fail(res.d.error || 'Could not sign in');
        location.href = '/admin';
      })
      .catch(function () { fail('Could not reach the server'); });
  });
})();
