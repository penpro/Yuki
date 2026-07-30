'use strict';

// Admin dashboard. Plain fetch + DOM, no framework — this is a handful of
// CRUD screens and a build step would be more to maintain than the app.
//
// Everything user-supplied is written with textContent or via setAttribute,
// never innerHTML with interpolation. The admin is trusted, but a stored
// value that renders as markup here would still be a stored XSS.

(function () {
  var api = {
    get: function (p) { return req('GET', p); },
    post: function (p, b) { return req('POST', p, b); },
    put: function (p, b) { return req('PUT', p, b); },
    del: function (p) { return req('DELETE', p); },
  };

  function req(method, path, body) {
    return fetch(path, {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (r.status === 401) { location.href = '/admin/login'; throw new Error('signed out'); }
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Request failed');
        return d;
      });
    });
  }

  var el = function (id) { return document.getElementById(id); };

  /* ── chrome ─────────────────────────────────────────────── */

  if (location.protocol !== 'https:' && location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1') {
    el('insecure').hidden = false;
  }

  api.get('/admin/me').then(function (u) {
    el('who').textContent = u.displayName || u.email;
  }).catch(function () {});

  el('logout').addEventListener('click', function () {
    api.post('/admin/logout').then(function () { location.href = '/admin/login'; });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) {
        x.classList.toggle('tab--on', x === t);
      });
      el('panel-resources').hidden = t.dataset.panel !== 'resources';
      el('panel-testimonials').hidden = t.dataset.panel !== 'testimonials';
    });
  });

  /* ── editor dialog ──────────────────────────────────────── */

  var dlg = el('editor');
  var saveHandler = null;

  function field(label, name, value, opts) {
    opts = opts || {};
    var wrap = document.createElement('label');
    wrap.className = 'field';
    var lab = document.createElement('span');
    lab.className = 'field__label';
    lab.textContent = label;
    var input = document.createElement(opts.textarea ? 'textarea' : 'input');
    if (!opts.textarea) input.type = opts.type || 'text';
    input.className = 'field__input';
    input.name = name;
    input.value = value == null ? '' : String(value);
    if (opts.placeholder) input.placeholder = opts.placeholder;
    wrap.appendChild(lab); wrap.appendChild(input);
    return wrap;
  }

  function checkbox(label, name, checked) {
    var wrap = document.createElement('label');
    wrap.className = 'field--check';
    var input = document.createElement('input');
    input.type = 'checkbox'; input.name = name; input.checked = !!checked;
    var span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(input); wrap.appendChild(span);
    return wrap;
  }

  function openEditor(title, fields, onSave) {
    el('editorTitle').textContent = title;
    var box = el('editorFields');
    box.textContent = '';
    fields.forEach(function (f) { box.appendChild(f); });
    el('editorError').hidden = true;
    saveHandler = onSave;
    dlg.showModal();
  }

  function values() {
    var out = {};
    Array.prototype.forEach.call(el('editorFields').querySelectorAll('input,textarea,select'),
      function (i) { out[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
    return out;
  }

  el('editorSave').addEventListener('click', function () {
    if (!saveHandler) return;
    var btn = el('editorSave');
    btn.disabled = true; btn.textContent = 'saving…';
    Promise.resolve(saveHandler(values()))
      .then(function () { dlg.close(); refreshAll(); })
      .catch(function (e) { el('editorError').textContent = e.message; el('editorError').hidden = false; })
      .then(function () { btn.disabled = false; btn.textContent = 'save'; });
  });

  /* ── generic row rendering ──────────────────────────────── */

  function pill(on) {
    var s = document.createElement('span');
    s.className = 'pill ' + (on ? 'pill--on' : 'pill--off');
    s.textContent = on ? 'published' : 'draft';
    return s;
  }

  function actionBtn(label, cls, fn) {
    var b = document.createElement('button');
    b.className = 'btn btn--sm ' + cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function renderRows(host, items, build) {
    host.textContent = '';
    if (!items.length) {
      var p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'nothing here yet.';
      host.appendChild(p);
      return;
    }
    items.forEach(function (item) { host.appendChild(build(item)); });
  }

  /* ── resources ──────────────────────────────────────────── */

  function resourceFields(r) {
    r = r || {};
    var f = [
      field('title', 'title', r.title),
      field('category', 'kind', r.kind || 'guide', { placeholder: 'cbt workbook' }),
      field('description', 'blurb', r.blurb, { textarea: true }),
      field('link', 'href', r.href, { placeholder: 'guides/breathing.html' }),
      field('sort order', 'sort_order', r.sort_order == null ? 0 : r.sort_order, { type: 'number' }),
    ];

    // upload
    var row = document.createElement('div');
    row.className = 'uploadrow';
    var file = document.createElement('input');
    file.type = 'file';
    var hidden = document.createElement('input');
    hidden.type = 'hidden'; hidden.name = 'file_path'; hidden.value = r.file_path || '';
    var status = document.createElement('span');
    status.className = 'muted';
    status.style.fontSize = '.78rem';
    status.textContent = r.file_path ? 'attached: ' + r.file_path : 'or upload a file';

    file.addEventListener('change', function () {
      if (!file.files[0]) return;
      status.textContent = 'uploading…';
      var fd = new FormData();
      fd.append('file', file.files[0]);
      fetch('/api/admin/uploads', { method: 'POST', credentials: 'same-origin', body: fd })
        .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d.error); return d; }); })
        .then(function (d) { hidden.value = d.file_path; status.textContent = 'attached: ' + d.file_path; })
        .catch(function (e) { status.textContent = 'upload failed: ' + e.message; });
    });

    row.appendChild(file); row.appendChild(status); row.appendChild(hidden);
    f.push(row);
    f.push(checkbox('has a printer-friendly view', 'printable', r.printable));
    f.push(checkbox('published — visible on the site', 'published', r.published));
    return f;
  }

  function loadResources() {
    return api.get('/api/admin/resources').then(function (rows) {
      renderRows(el('resourceList'), rows, function (r) {
        var row = document.createElement('div');
        row.className = 'row';

        var ord = document.createElement('div');
        ord.className = 'row__order';
        ord.textContent = r.sort_order;

        var mid = document.createElement('div');
        var h = document.createElement('p');
        h.className = 'row__title';
        h.textContent = r.title;
        var meta = document.createElement('div');
        meta.className = 'row__meta';
        meta.textContent = r.kind + ' · ' + (r.file_path || r.href || 'no link') + ' ';
        meta.appendChild(pill(r.published));
        mid.appendChild(h); mid.appendChild(meta);
        if (r.blurb) {
          var b = document.createElement('p');
          b.className = 'row__body';
          b.textContent = r.blurb.length > 150 ? r.blurb.slice(0, 150) + '…' : r.blurb;
          mid.appendChild(b);
        }

        var acts = document.createElement('div');
        acts.className = 'row__actions';
        acts.appendChild(actionBtn('edit', 'btn--ghost', function () {
          openEditor('edit resource', resourceFields(r), function (v) {
            return api.put('/api/admin/resources/' + r.id, v);
          });
        }));
        acts.appendChild(actionBtn(r.published ? 'unpublish' : 'publish', 'btn--ghost', function () {
          return api.put('/api/admin/resources/' + r.id,
            Object.assign({}, r, { published: !r.published })).then(refreshAll);
        }));
        acts.appendChild(actionBtn('delete', 'btn--ghost btn--danger', function () {
          if (!confirm('Delete "' + r.title + '"? This cannot be undone.')) return;
          return api.del('/api/admin/resources/' + r.id).then(refreshAll);
        }));

        row.appendChild(ord); row.appendChild(mid); row.appendChild(acts);
        return row;
      });
    });
  }

  el('newResource').addEventListener('click', function () {
    openEditor('add resource', resourceFields(null), function (v) {
      return api.post('/api/admin/resources', v);
    });
  });

  /* ── testimonials ───────────────────────────────────────── */

  function testimonialFields(t) {
    t = t || {};
    return [
      field('name', 'author', t.author, { placeholder: 'first name, or how they want to be credited' }),
      field('what they said', 'body', t.body, { textarea: true }),
      field('context', 'context', t.context, { placeholder: 'deep clean, 45 min' }),
      field('sort order', 'sort_order', t.sort_order == null ? 0 : t.sort_order, { type: 'number' }),
      checkbox('published — visible on the site', 'published', t.published),
    ];
  }

  function loadTestimonials() {
    return api.get('/api/admin/testimonials').then(function (rows) {
      renderRows(el('testimonialList'), rows, function (t) {
        var row = document.createElement('div');
        row.className = 'row';

        var ord = document.createElement('div');
        ord.className = 'row__order';
        ord.textContent = t.sort_order;

        var mid = document.createElement('div');
        var h = document.createElement('p');
        h.className = 'row__title';
        h.textContent = t.author + (t.context ? ' — ' + t.context : '');
        var meta = document.createElement('div');
        meta.className = 'row__meta';
        meta.appendChild(pill(t.published));
        var b = document.createElement('p');
        b.className = 'row__body';
        b.textContent = t.body.length > 180 ? t.body.slice(0, 180) + '…' : t.body;
        mid.appendChild(h); mid.appendChild(meta); mid.appendChild(b);

        var acts = document.createElement('div');
        acts.className = 'row__actions';
        acts.appendChild(actionBtn('edit', 'btn--ghost', function () {
          openEditor('edit testimonial', testimonialFields(t), function (v) {
            return api.put('/api/admin/testimonials/' + t.id, v);
          });
        }));
        acts.appendChild(actionBtn(t.published ? 'unpublish' : 'publish', 'btn--ghost', function () {
          return api.put('/api/admin/testimonials/' + t.id,
            Object.assign({}, t, { published: !t.published })).then(refreshAll);
        }));
        acts.appendChild(actionBtn('delete', 'btn--ghost btn--danger', function () {
          if (!confirm('Delete the quote from ' + t.author + '? This cannot be undone.')) return;
          return api.del('/api/admin/testimonials/' + t.id).then(refreshAll);
        }));

        row.appendChild(ord); row.appendChild(mid); row.appendChild(acts);
        return row;
      });
    });
  }

  el('newTestimonial').addEventListener('click', function () {
    openEditor('add testimonial', testimonialFields(null), function (v) {
      return api.post('/api/admin/testimonials', v);
    });
  });

  /* ── boot ───────────────────────────────────────────────── */

  function refreshAll() {
    return Promise.all([loadResources(), loadTestimonials()]).catch(function (e) {
      console.error(e);
    });
  }

  refreshAll();
})();
