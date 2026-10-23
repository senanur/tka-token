// Tampilan TV: ambil token tiap 5 detik, perbarui teks di tempat.
// Kalau gagal, token terakhir TETAP tampil dan status berubah jadi peringatan.
(function () {
  var POLL_MS = 5000;
  var STALE_MS = 30000;          // > 30 dtk tanpa data baru = merah
  var RELOAD_MS = 60 * 60 * 1000; // reload penuh tiap jam, hanya bila server terjangkau

  var state = null;       // respons terakhir yang berhasil
  var offset = 0;         // jam server - jam TV
  var lastOkAt = 0;
  var shown = { smk: undefined, sma: undefined };
  var loadedAt = Date.now();

  var statusEl = document.getElementById('status');
  var clockEl = document.getElementById('clock');

  function now() { return Date.now() + offset; }

  function setStatus(cls, text) {
    statusEl.className = 'status ' + cls;
    statusEl.textContent = text;
  }

  function renderToken(key, entry) {
    var slot = document.querySelector('.slot[data-key="' + key + '"]');
    var tokenEl = slot.querySelector('.token');
    var metaEl = slot.querySelector('.slot-meta');
    var value = entry ? entry.token : null;
    if (shown[key] === value) return;
    var isFirstRender = shown[key] === undefined;
    shown[key] = value;

    if (!value) {
      tokenEl.className = 'token empty';
      tokenEl.textContent = 'Belum ada token';
      metaEl.textContent = '';
      return;
    }
    tokenEl.innerHTML = '';
    for (var i = 0; i < value.length; i++) {
      var s = document.createElement('span');
      s.textContent = value.charAt(i);
      tokenEl.appendChild(s);
    }
    metaEl.textContent = 'Diperbarui ' + TKA.clock(entry.updatedAt);
    tokenEl.className = 'token';
    if (!isFirstRender) {
      void tokenEl.offsetWidth; // restart animasi
      tokenEl.className = 'token changed';
    }
  }

  function renderCountdowns() {
    if (!state) return;
    ['smk', 'sma'].forEach(function (key) {
      var el = document.querySelector('.slot[data-key="' + key + '"] .countdown');
      var left = TKA.remaining(state[key], state.durationSec, now());
      if (left === null) { el.textContent = ''; el.className = 'countdown'; return; }
      if (left <= 0) { el.textContent = 'Waktu habis'; el.className = 'countdown over'; return; }
      el.textContent = 'Sisa ' + TKA.mmss(left);
      el.className = 'countdown' + (left <= 60 ? ' low' : '');
    });
  }

  function tick() {
    clockEl.textContent = TKA.clock(now());
    renderCountdowns();
    if (lastOkAt && Date.now() - lastOkAt > STALE_MS) {
      setStatus('bad', 'Koneksi terputus · data mungkin usang');
    }
  }

  function poll() {
    TKA.getToken('', 4000).then(function (res) {
      state = res.data;
      offset = res.offset;
      lastOkAt = Date.now();
      renderToken('smk', state.smk);
      renderToken('sma', state.sma);
      setStatus('ok', 'Terhubung');
      tick();
      if (Date.now() - loadedAt > RELOAD_MS) location.reload();
    }).catch(function () {
      if (!lastOkAt || Date.now() - lastOkAt <= STALE_MS) setStatus('warn', 'Koneksi terputus · mencoba lagi');
      else setStatus('bad', 'Koneksi terputus · data mungkin usang');
    }).then(function () {
      setTimeout(poll, POLL_MS);
    });
  }

  setInterval(tick, 250);
  poll();
})();
