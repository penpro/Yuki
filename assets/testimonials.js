/* Pulls published testimonials from the backend and reveals the section.
   Kept separate from main.js so a backend outage can't take the rest of the
   page's behaviour down with it.

   Everything is written with textContent, never innerHTML — these strings
   come out of a database and would otherwise be a stored-XSS route. */
(function () {
  'use strict';

  var section = document.getElementById('quotes');
  var list = document.getElementById('quotelist');
  if (!section || !list) return;

  fetch('/api/testimonials', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      if (!Array.isArray(rows) || rows.length === 0) return;   // stay hidden

      rows.forEach(function (t, i) {
        var fig = document.createElement('figure');
        fig.className = 'quote reveal';
        fig.style.setProperty('--i', String(i % 3));

        var q = document.createElement('blockquote');
        q.className = 'quote__body';
        q.textContent = t.body;

        var cap = document.createElement('figcaption');
        cap.className = 'quote__by';
        cap.textContent = t.author + (t.context ? ' · ' + t.context : '');

        fig.appendChild(q);
        fig.appendChild(cap);
        list.appendChild(fig);
      });

      section.hidden = false;

      // main.js has already run its pass over .reveal elements, so these
      // arrived too late to be observed. Show them directly.
      requestAnimationFrame(function () {
        Array.prototype.forEach.call(list.querySelectorAll('.reveal'), function (el) {
          el.classList.add('is-in');
        });
      });
    })
    .catch(function () { /* backend down: section simply stays hidden */ });
})();
