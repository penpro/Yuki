/* Workbook view toggle.
   External rather than inline so the site can run a strict
   Content-Security-Policy without needing script-src 'unsafe-inline'. */
(function () {
  'use strict';

  var b = document.body;
  var t = document.getElementById('bwToggle');
  var p = document.getElementById('printBtn');
  if (!b || !t) return;

  function setBW(on) {
    b.classList.toggle('print-preview', on);
    t.setAttribute('aria-pressed', String(on));
    t.classList.toggle('wbbtn--on', on);
    t.textContent = on ? 'pretty version' : 'printer friendly';
  }

  // resources.html links straight to the B&W view with ?print
  if (/[?&]print/.test(location.search)) setBW(true);

  t.addEventListener('click', function () {
    setBW(!b.classList.contains('print-preview'));
  });

  if (p) {
    p.addEventListener('click', function () { window.print(); });
  }
})();
