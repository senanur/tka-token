// Utilitas bersama tampilan TV dan admin. Ditulis tanpa sintaks modern (?. ??)
// supaya tetap jalan di browser bawaan TV yang lebih tua.
(function () {
  var cfg = window.TKA_CONFIG || {};
  var tz = cfg.timeZone || 'Asia/Makassar';
  var fmt;
  try {
    fmt = new Intl.DateTimeFormat('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch (e) {
    fmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  window.TKA = {
    clock: function (ms) { return fmt.format(new Date(ms)).replace(/\./g, ':'); },

    // Sisa detik sampai token habis, atau null kalau belum ada token.
    // Token TKA berganti mengikuti jam: periode durationSec dihitung dari jam bulat
    // (600 = tiap :00, :10, :20, ...). Token yang disimpan 08:03 habis 08:10.
    remaining: function (entry, durationSec, nowMs) {
      if (!entry) return null;
      var period = durationSec * 1000;
      var expiresAt = (Math.floor(entry.updatedAt / period) + 1) * period;
      return Math.ceil((expiresAt - nowMs) / 1000);
    },
    mmss: function (sec) { return Math.floor(sec / 60) + ':' + pad(sec % 60); },

    // fetch dengan batas waktu. Mengembalikan { data, offset } ;
    // offset = selisih jam server dikurangi jam perangkat.
    getToken: function (base, timeoutMs) {
      var t0 = Date.now();
      var timer;
      var timeout = new Promise(function (_, reject) {
        timer = setTimeout(function () { reject(new Error('timeout')); }, timeoutMs || 4000);
      });
      var req = fetch(base + '/api/token?t=' + t0, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
      return Promise.race([req, timeout]).then(function (data) {
        clearTimeout(timer);
        var t1 = Date.now();
        return { data: data, offset: data.serverTime - (t0 + t1) / 2 };
      }, function (err) { clearTimeout(timer); throw err; });
    },
  };
})();
