// Admin: tulis token ke semua server sekaligus, lalu pantau isi tiap server tiap 5 detik.
(function () {
  var POLL_MS = 5000;
  var cfg = window.TKA_CONFIG || {};
  var KEYS = ['smk', 'sma'];
  var LABEL = { smk: 'SMK', sma: 'SMA' };

  // --- Daftar server (tanpa duplikat) ---
  var seen = {};
  var skipped = [];
  var hosts = [];
  (cfg.endpoints || [{ name: 'Server ini', url: '' }]).forEach(function (ep) {
    if (ep.url === null || ep.url === undefined) { skipped.push(ep.name + ' (belum diatur)'); return; }
    var base = (ep.url || location.origin).replace(/\/+$/, '');
    if (seen[base]) return;
    if (location.protocol === 'https:' && base.indexOf('http:') === 0) {
      skipped.push(ep.name + ' (http tidak bisa dari halaman https — buka admin dari server lab)');
      return;
    }
    seen[base] = true;
    hosts.push({ name: ep.name, base: base, data: null, offset: 0, ok: false });
  });
  document.getElementById('cfg-note').textContent =
    'Menulis ke: ' + hosts.map(function (h) { return h.name; }).join(', ') +
    (skipped.length ? '. Dilewati: ' + skipped.join('; ') + '.' : '.');

  // --- PIN (sessionStorage, dibungkus try karena bisa diblokir) ---
  var pinEl = document.getElementById('pin');
  try { pinEl.value = sessionStorage.getItem('tka-pin') || ''; } catch (e) {}
  pinEl.addEventListener('input', function () {
    try { sessionStorage.setItem('tka-pin', pinEl.value); } catch (e) {}
  });

  function card(key) { return document.querySelector('.card[data-key="' + key + '"]'); }

  // --- Kirim ke satu server ---
  function post(host, body) {
    var timer;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () { reject(new Error('tidak merespons')); }, 6000);
    });
    var req = fetch(host.base + '/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pinEl.value },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
    return Promise.race([req, timeout]).then(function (j) {
      clearTimeout(timer); host.data = j; host.ok = true; return j;
    }, function (err) {
      clearTimeout(timer);
      throw new Error(err && err.message === 'Failed to fetch' ? 'tidak terjangkau' : (err && err.message) || 'gagal');
    });
  }

  function submit(key, token) {
    var c = card(key);
    var errEl = c.querySelector('.err');
    var resultEl = c.querySelector('.result');
    var input = c.querySelector('input.tok');
    errEl.textContent = '';

    if (!pinEl.value) { errEl.textContent = 'Isi PIN admin dulu.'; pinEl.focus(); return; }
    if (token !== null && !/^[A-Z]{6}$/.test(token)) {
      errEl.textContent = 'Token harus tepat 6 huruf (A–Z).'; input.focus(); return;
    }
    if (token === null && !confirm('Kosongkan token ' + LABEL[key] + ' di semua server?')) return;

    var buttons = c.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-busy', 'true');
    resultEl.innerHTML = '';

    var jobs = hosts.map(function (h) {
      return post(h, { key: key, token: token }).then(
        function () { return { host: h, ok: true }; },
        function (e) { return { host: h, ok: false, msg: e.message }; }
      );
    });
    Promise.all(jobs).then(function (results) {
      var allOk = true;
      results.forEach(function (r) {
        var line = document.createElement('div');
        line.className = r.ok ? 'ok' : 'bad';
        line.textContent = (r.ok ? '✓ ' : '✗ ') + r.host.name + (r.ok ? ' · ' + TKA.clock(Date.now()) : ' · ' + r.msg);
        resultEl.appendChild(line);
        if (!r.ok) allOk = false;
      });
      if (allOk && token !== null) input.value = '';
      for (var i = 0; i < buttons.length; i++) buttons[i].removeAttribute('aria-busy');
      renderHosts();
    });
  }

  KEYS.forEach(function (key) {
    var c = card(key);
    var input = c.querySelector('input.tok');
    input.addEventListener('input', function () {
      var clean = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
      if (clean !== input.value) input.value = clean;
      c.querySelector('.err').textContent = '';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit(key, input.value);
    });
    c.querySelector('button.save').addEventListener('click', function () { submit(key, input.value); });
    c.querySelector('button.clear').addEventListener('click', function () { submit(key, null); });
  });

  // --- Pantau isi tiap server ---
  function renderHosts() {
    KEYS.forEach(function (key) {
      var box = card(key).querySelector('.hosts');
      var values = {};
      hosts.forEach(function (h) { if (h.ok && h.data) values[h.data[key] ? h.data[key].token : '—'] = true; });
      var mismatch = Object.keys(values).length > 1;

      box.innerHTML = '';
      hosts.forEach(function (h) {
        var row = document.createElement('div');
        var name = document.createElement('span');
        var val = document.createElement('span');
        name.className = 'name'; val.className = 'val';
        name.textContent = h.name;
        if (!h.ok || !h.data) {
          row.className = 'host bad'; val.textContent = 'tidak terjangkau';
        } else {
          var entry = h.data[key];
          if (!entry) {
            row.className = 'host' + (mismatch ? ' warn' : ''); val.textContent = 'kosong';
          } else {
            var left = TKA.remaining(entry, h.data.durationSec, Date.now() + h.offset);
            var cd = left > 0 ? 'sisa ' + TKA.mmss(left) : 'waktu habis';
            row.className = 'host ' + (mismatch ? 'warn' : left > 0 ? 'ok' : 'bad');
            val.textContent = entry.token + ' · ' + cd + (mismatch ? ' · beda!' : '');
          }
        }
        row.appendChild(name); row.appendChild(val);
        box.appendChild(row);
      });
    });
  }

  function pollAll() {
    var jobs = hosts.map(function (h) {
      return TKA.getToken(h.base, 4000).then(function (res) {
        h.data = res.data; h.offset = res.offset; h.ok = true;
      }, function () { h.ok = false; });
    });
    Promise.all(jobs).then(function () {
      renderHosts();
      setTimeout(pollAll, POLL_MS);
    });
  }

  setInterval(renderHosts, 1000);
  pollAll();
})();
