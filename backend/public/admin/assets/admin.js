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
      // Generic, so adding a tab means adding markup and nothing else.
      Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) {
        p.hidden = p.id !== 'panel-' + t.dataset.panel;
      });
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

  /* ── mailing list ───────────────────────────────────────── */

  var filterEls = ['fq', 'fstatus', 'fsource', 'fsort', 'ffrom', 'fto'];

  function filterQuery() {
    var p = new URLSearchParams();
    if (el('fq').value.trim()) p.set('q', el('fq').value.trim());
    if (el('fstatus').value) p.set('status', el('fstatus').value);
    if (el('fsource').value) p.set('source', el('fsource').value);
    if (el('fsort').value) p.set('sort', el('fsort').value);
    if (el('ffrom').value) p.set('from', el('ffrom').value);
    if (el('fto').value) p.set('to', el('fto').value);
    return p.toString();
  }

  function statusPill(status) {
    var s = document.createElement('span');
    var cls = { confirmed: 'pill--on', pending: 'pill--pending',
                unsubscribed: 'pill--unsub', bounced: 'pill--bounced' }[status] || 'pill--off';
    s.className = 'pill ' + cls;
    s.textContent = status;
    return s;
  }

  function loadStats() {
    return api.get('/api/admin/subscribers/stats').then(function (d) {
      var box = el('subStats');
      box.textContent = '';
      [['confirmed', 'can be mailed'], ['pending', 'not confirmed'],
       ['unsubscribed', 'opted out'], ['bounced', 'undeliverable']].forEach(function (pair) {
        var s = document.createElement('div');
        s.className = 'stat' + (pair[0] === 'confirmed' ? '' : ' stat--muted');
        var b = document.createElement('b');
        b.textContent = d.stats[pair[0]] || 0;
        var t = document.createElement('span');
        t.textContent = pair[1];
        s.appendChild(b); s.appendChild(t);
        box.appendChild(s);
      });

      // keep the source filter in sync with what actually exists
      var sel = el('fsource'), cur = sel.value;
      sel.textContent = '';
      var any = document.createElement('option');
      any.value = ''; any.textContent = 'any source';
      sel.appendChild(any);
      d.sources.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.source; o.textContent = s.source + ' (' + s.n + ')';
        sel.appendChild(o);
      });
      sel.value = cur;

      // surface the SMTP state on the newsletter tab
      var warn = el('smtpWarn');
      if (!d.mailConfigured) {
        warn.textContent = 'Email sending is not set up yet, so nothing can go out. '
          + 'Signups are still being recorded and will get their confirmation email '
          + 'as soon as an SMTP relay is configured in the backend .env file.';
        warn.hidden = false;
      } else {
        warn.hidden = true;
      }
    });
  }

  function subscriberFields(s) {
    s = s || {};
    var f = [field('email', 'email', s.email, { type: 'email' })];
    if (s.id) f[0].querySelector('input').readOnly = true;
    f.push(field('name', 'name', s.name));
    f.push(field('source', 'source', s.source || 'manual'));
    f.push(field('notes', 'notes', s.notes, { textarea: true }));

    if (s.id) {
      var wrap = document.createElement('label');
      wrap.className = 'field';
      var lab = document.createElement('span');
      lab.className = 'field__label'; lab.textContent = 'status';
      var sel = document.createElement('select');
      sel.className = 'field__input'; sel.name = 'status';
      ['confirmed', 'pending', 'unsubscribed', 'bounced'].forEach(function (v) {
        var o = document.createElement('option');
        o.value = v; o.textContent = v;
        if (s.status === v) o.selected = true;
        sel.appendChild(o);
      });
      wrap.appendChild(lab); wrap.appendChild(sel);
      f.push(wrap);
    }
    return f;
  }

  function loadSubscribers() {
    var qs = filterQuery();
    return api.get('/api/admin/subscribers?' + qs).then(function (d) {
      el('subCount').textContent = d.total === d.returned
        ? d.total + ' matching'
        : 'showing ' + d.returned + ' of ' + d.total + ' matching';

      renderRows(el('subscriberList'), d.rows, function (s) {
        var row = document.createElement('div');
        row.className = 'row subrow';

        var mid = document.createElement('div');
        var e = document.createElement('div');
        e.className = 'subrow__email';
        e.textContent = s.email + (s.name ? '  (' + s.name + ')' : '');
        var meta = document.createElement('div');
        meta.className = 'subrow__meta';
        meta.appendChild(statusPill(s.status));
        var extra = document.createElement('span');
        extra.textContent = '  ' + s.source
          + ' · joined ' + String(s.created_at).slice(0, 10)
          + (s.send_count ? ' · ' + s.send_count + ' sent' : '');
        meta.appendChild(extra);
        mid.appendChild(e); mid.appendChild(meta);
        if (s.notes) {
          var n = document.createElement('p');
          n.className = 'row__body'; n.textContent = s.notes;
          mid.appendChild(n);
        }

        var acts = document.createElement('div');
        acts.className = 'row__actions';
        acts.appendChild(actionBtn('edit', 'btn--ghost', function () {
          openEditor('edit subscriber', subscriberFields(s), function (v) {
            return api.put('/api/admin/subscribers/' + s.id, v);
          });
        }));
        acts.appendChild(actionBtn('remove', 'btn--ghost btn--danger', function () {
          if (!confirm('Delete ' + s.email + '? Marking them unsubscribed is usually better — '
            + 'deleting means they can be re-added and mailed again by mistake.')) return;
          return api.del('/api/admin/subscribers/' + s.id).then(refreshMail);
        }));

        row.appendChild(mid); row.appendChild(acts);
        return row;
      });
    });
  }

  var debounce;
  filterEls.forEach(function (id) {
    el(id).addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(loadSubscribers, 250);
    });
  });
  el('clearFilters').addEventListener('click', function () {
    filterEls.forEach(function (id) { el(id).value = ''; });
    el('fsort').value = 'newest';
    loadSubscribers();
  });

  el('newSubscriber').addEventListener('click', function () {
    openEditor('add someone', subscriberFields(null), function (v) {
      return api.post('/api/admin/subscribers', v);
    });
  });

  el('exportList').addEventListener('click', function () {
    window.location = '/api/admin/subscribers/export?' + filterQuery();
  });

  // Copy respects the current filter, so "everyone who signed up from the
  // resources page in March" is a copyable list, not just "everyone".
  el('copyList').addEventListener('click', function () {
    fetch('/api/admin/subscribers/copy?' + filterQuery(), { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var count = text ? text.split('\n').length : 0;
        var box = document.createElement('div');
        var p = document.createElement('p');
        p.className = 'muted';
        p.style.fontSize = '.85rem';
        p.textContent = count + ' address' + (count === 1 ? '' : 'es')
          + ' matching your current filter. Copied to your clipboard — '
          + 'or select and copy from here.';
        var ta = document.createElement('textarea');
        ta.className = 'copybox';
        ta.value = text;
        box.appendChild(p); box.appendChild(ta);

        openEditor('copy addresses', [box], function () {});
        el('editorSave').textContent = 'done';
        ta.select();
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      });
  });

  /* ── mail blast ─────────────────────────────────────────── */

  function campaignFields(c) {
    c = c || {};
    var f = [
      field('subject', 'subject', c.subject),
      field('preview line', 'preheader', c.preheader,
        { placeholder: 'the grey text inboxes show under the subject' }),
      field('body', 'body', c.body, { textarea: true }),
      field('button label', 'cta_label', c.cta_label, { placeholder: 'book a session' }),
      field('button link', 'cta_url', c.cta_url, { placeholder: 'https://…' }),
    ];
    f[2].querySelector('textarea').style.minHeight = '14rem';
    var hint = document.createElement('p');
    hint.className = 'muted';
    hint.style.fontSize = '.8rem';
    hint.textContent = 'Write it as plain text. Leave a blank line between paragraphs — '
      + 'that is what becomes the spacing in the email. No formatting codes needed.';
    f.splice(3, 0, hint);
    // carry the link back to whatever prompted this newsletter
    ['source_type', 'source_id'].forEach(function (k) {
      var h = document.createElement('input');
      h.type = 'hidden'; h.name = k; h.value = c[k] || '';
      f.push(h);
    });
    return f;
  }

  function loadSuggestions() {
    return api.get('/api/admin/suggestions').then(function (rows) {
      renderRows(el('suggestionList'), rows, function (s) {
        var row = document.createElement('div');
        row.className = 'row sug';

        var mid = document.createElement('div');
        var t = document.createElement('div');
        t.className = 'sug__type'; t.textContent = s.type;
        var h = document.createElement('p');
        h.className = 'row__title'; h.textContent = s.title;
        var d = document.createElement('p');
        d.className = 'row__body'; d.textContent = s.detail || '';
        mid.appendChild(t); mid.appendChild(h); mid.appendChild(d);

        var acts = document.createElement('div');
        acts.className = 'row__actions';
        acts.appendChild(actionBtn('write newsletter', 'btn--gold', function () {
          openEditor('newsletter about this', campaignFields({
            subject: s.subject, body: s.body,
            cta_label: s.cta_label, cta_url: s.cta_url,
            source_type: s.type, source_id: s.id,
          }), function (v) { return api.post('/api/admin/campaigns', v); });
        }));

        row.appendChild(mid); row.appendChild(acts);
        return row;
      });
    });
  }

  var pollTimer = null;

  function loadCampaigns() {
    return api.get('/api/admin/campaigns').then(function (rows) {
      var anySending = false;

      renderRows(el('campaignList'), rows, function (c) {
        if (c.status === 'sending') anySending = true;

        var row = document.createElement('div');
        row.className = 'row';

        var ord = document.createElement('div');
        ord.className = 'row__order';
        ord.textContent = String(c.created_at).slice(5, 10);

        var mid = document.createElement('div');
        var h = document.createElement('p');
        h.className = 'row__title'; h.textContent = c.subject;
        var meta = document.createElement('div');
        meta.className = 'row__meta';
        var p = document.createElement('span');
        p.className = 'pill ' + (c.status === 'sent' ? 'pill--on'
          : c.status === 'failed' ? 'pill--unsub'
          : c.status === 'sending' ? 'pill--pending' : 'pill--off');
        p.textContent = c.status;
        meta.appendChild(p);
        var info = document.createElement('span');
        info.textContent = c.status === 'draft' ? '  not sent yet'
          : '  ' + c.sent_count + ' of ' + c.recipient_count + ' sent'
            + (c.failed_count ? ' · ' + c.failed_count + ' failed' : '');
        meta.appendChild(info);
        mid.appendChild(h); mid.appendChild(meta);

        if (c.status === 'sending' || (c.status === 'sent' && c.recipient_count)) {
          var bar = document.createElement('div');
          bar.className = 'progress';
          var fill = document.createElement('div');
          fill.className = 'progress__bar';
          fill.style.width = Math.round(100 * c.sent_count / Math.max(c.recipient_count, 1)) + '%';
          bar.appendChild(fill);
          mid.appendChild(bar);
        }
        if (c.last_error) {
          var e = document.createElement('p');
          e.className = 'row__body';
          e.style.color = '#F0A8A8';
          e.textContent = 'last error: ' + c.last_error;
          mid.appendChild(e);
        }

        var acts = document.createElement('div');
        acts.className = 'row__actions';

        acts.appendChild(actionBtn('preview', 'btn--ghost', function () {
          window.open('/api/admin/campaigns/' + c.id + '/preview', '_blank', 'noopener');
        }));

        if (c.status === 'draft') {
          acts.appendChild(actionBtn('edit', 'btn--ghost', function () {
            openEditor('edit newsletter', campaignFields(c), function (v) {
              return api.put('/api/admin/campaigns/' + c.id, v);
            });
          }));
          acts.appendChild(actionBtn('test send', 'btn--ghost', function () {
            var to = prompt('Send a test copy to which address?', 'wistyuki@gmail.com');
            if (!to) return;
            return api.post('/api/admin/campaigns/' + c.id + '/test', { to: to })
              .then(function () { alert('Test sent to ' + to); })
              .catch(function (e) { alert(e.message); });
          }));
          acts.appendChild(actionBtn('send to everyone', 'btn--gold', function () {
            if (!confirm('Send "' + c.subject + '" to everyone who has confirmed?\n\n'
              + 'This cannot be undone or recalled.')) return;
            return api.post('/api/admin/campaigns/' + c.id + '/send')
              .then(function (d) { alert('Sending to ' + d.recipients + ' people.'); refreshMail(); })
              .catch(function (e) { alert(e.message); });
          }));
        }

        acts.appendChild(actionBtn('delete', 'btn--ghost btn--danger', function () {
          if (!confirm('Delete "' + c.subject + '"?')) return;
          return api.del('/api/admin/campaigns/' + c.id).then(refreshMail);
        }));

        row.appendChild(ord); row.appendChild(mid); row.appendChild(acts);
        return row;
      });

      // While something is going out, refresh so she can watch it progress.
      clearTimeout(pollTimer);
      if (anySending) pollTimer = setTimeout(loadCampaigns, 3000);
    });
  }

  el('newCampaign').addEventListener('click', function () {
    openEditor('write a newsletter', campaignFields(null), function (v) {
      return api.post('/api/admin/campaigns', v);
    });
  });

  /* ── visits ─────────────────────────────────────────────── */

  function miniRows(host, rows, labelOf, nOf, subOf) {
    host.textContent = '';
    if (!rows.length) {
      var p = document.createElement('p');
      p.className = 'muted';
      p.style.fontSize = '.85rem';
      p.textContent = 'nothing yet.';
      host.appendChild(p);
      return;
    }
    var max = Math.max.apply(null, rows.map(nOf)) || 1;
    rows.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'minirow';

      // proportional fill behind the text, so each row reads as a share
      var fill = document.createElement('div');
      fill.className = 'minirow__fill';
      fill.style.width = Math.round(100 * nOf(r) / max) + '%';

      var lab = document.createElement('span');
      lab.className = 'minirow__label';
      lab.textContent = labelOf(r);

      var n = document.createElement('span');
      n.className = 'minirow__n';
      n.textContent = nOf(r);
      if (subOf) {
        var s = document.createElement('small');
        s.textContent = ' ' + subOf(r);
        n.appendChild(s);
      }

      row.appendChild(fill); row.appendChild(lab); row.appendChild(n);
      host.appendChild(row);
    });
  }

  function delta(now, before) {
    var el = document.createElement('span');
    if (!before) {
      el.className = 'stat__delta stat__delta--flat';
      el.textContent = before === 0 && now > 0 ? 'first data' : '—';
      return el;
    }
    var pct = Math.round(100 * (now - before) / before);
    el.className = 'stat__delta stat__delta--' + (pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat');
    el.textContent = (pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '') + Math.abs(pct) + '% vs previous';
    return el;
  }

  var EVENT_LABELS = {
    book_click: 'clicked through to book',
    signup: 'joined the mailing list',
    guide_open: 'opened a guide',
    print_view: 'opened the printable version',
    message_click: 'went to message her',
  };

  function loadStats() {
    var days = el('statRange').value;
    return api.get('/api/admin/stats?days=' + days).then(function (d) {
      // totals
      var box = el('statTotals');
      box.textContent = '';
      [['visitors', d.totals.visitors, d.previous.visitors],
       ['page views', d.totals.views, d.previous.views],
       ['book clicks', (d.events.find(function (e) { return e.name === 'book_click'; }) || {}).n || 0, null],
       ['signups', d.signups, null]].forEach(function (t) {
        var s = document.createElement('div');
        s.className = 'stat';
        var b = document.createElement('b');
        b.textContent = t[1];
        var lab = document.createElement('span');
        lab.textContent = t[0];
        s.appendChild(b); s.appendChild(lab);
        if (t[2] !== null && t[2] !== undefined) s.appendChild(delta(t[1], t[2]));
        box.appendChild(s);
      });

      // daily chart — fill in the gaps, or a quiet week looks like no data
      var chart = el('statChart');
      chart.textContent = '';
      var byDay = {};
      d.daily.forEach(function (r) { byDay[String(r.day).slice(0, 10)] = r.views; });
      var max = Math.max.apply(null, d.daily.map(function (r) { return r.views; }).concat([1]));
      for (var i = Number(days) - 1; i >= 0; i--) {
        var dt = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        var v = byDay[dt] || 0;
        var bar = document.createElement('div');
        bar.className = 'bar' + (v ? '' : ' bar--zero');
        bar.style.height = v ? Math.max(3, Math.round(100 * v / max)) + '%' : '2px';
        bar.title = dt + ' — ' + v + ' view' + (v === 1 ? '' : 's');
        chart.appendChild(bar);
      }

      miniRows(el('statEvents'), d.events,
        function (r) { return EVENT_LABELS[r.name] || r.name; },
        function (r) { return r.n; },
        function (r) { return '(' + r.people + ' people)'; });

      miniRows(el('statRefs'), d.refs,
        function (r) { return r.ref_host; }, function (r) { return r.views; });

      miniRows(el('statPages'), d.pages,
        function (r) { return r.path; },
        function (r) { return r.views; },
        function (r) { return '(' + r.visitors + ')'; });

      miniRows(el('statDevices'), d.devices,
        function (r) { return r.device; }, function (r) { return r.views; });
    });
  }

  el('statRange').addEventListener('change', loadStats);

  /* ── boot ───────────────────────────────────────────────── */

  function refreshMail() {
    return Promise.all([loadStats(), loadSubscribers(), loadCampaigns(), loadSuggestions()]);
  }

  function refreshAll() {
    return Promise.all([
      loadResources(), loadTestimonials(), refreshMail(),
    ]).catch(function (e) { console.error(e); });
  }

  refreshAll();
})();
