# Token TKA

Layar token TKA untuk TV/IFP. Token SMK dan SMA tampil besar, diperbarui dari HP lewat halaman admin, dan layar ikut berganti dalam ±5 detik. Berjalan di dua tempat sekaligus: **server lab** (Node.js) dan **Cloudflare** (Worker + Durable Object, paket gratis).

| Alamat | Untuk |
|---|---|
| `/` | Tampilan TV (buka fullscreen di browser TV/IFP) |
| `/admin` | Admin, dari HP/laptop. Perlu PIN. |

## Alamat deploy

| Server | Alamat | Deploy |
|---|---|---|
| Server lab | https://token.labpplg.web.id | Dokploy, project `tka-token`. Otomatis setiap push ke `main` (webhook GitHub). |
| Cloudflare | https://tka-token.acksyavi.workers.dev | `npm run cf:deploy` (manual) |

Admin bisa dibuka dari kedua alamat; keduanya https, jadi token selalu ditulis ke dua server.

## Struktur

```
public/          Halaman (sama persis di kedua server)
  config.js      ← satu-satunya file yang perlu diubah: daftar server & zona waktu
shared/core.js   Logika API (validasi, PIN, batas percobaan)
server/          Server lab: Node.js tanpa dependensi, token disimpan di data/state.json
worker/          Cloudflare Worker: token disimpan di Durable Object
```

## 1. Server lab

Butuh Node.js 18 ke atas. Tidak ada `npm install`.

```bash
ADMIN_PIN='pin-rahasia-anda' node server/server.js
# Token TKA berjalan di http://0.0.0.0:8080  (admin: /admin)
```

Variabel opsional: `PORT` (8080), `DURATION_SEC` (300, lama hitung mundur), `DATA_FILE`.

**Dengan Docker / Dokploy:** sudah ada `Dockerfile`. Set `ADMIN_PIN` di environment, dan mount volume ke `/app/data` supaya token tidak hilang saat container restart.

**Dengan systemd:** salin `deploy/tka-token.service` ke `/etc/systemd/system/`, sesuaikan path dan PIN, lalu `systemctl enable --now tka-token`.

## 2. Cloudflare

```bash
cd worker
npx wrangler login
npx wrangler secret put ADMIN_PIN      # isi PIN yang sama dengan server lab
npx wrangler deploy
```

Hasilnya alamat seperti `https://tka-token.namaakun.workers.dev`. Bisa juga dipasang di subdomain sendiri lewat Custom Domains di dashboard Cloudflare.

## 3. Hubungkan admin ke kedua server

Edit `public/config.js`, isi URL lengkap keduanya:

```js
endpoints: [
  { name: 'Server lab', url: 'http://token.labpplg.web.id' },
  { name: 'Cloudflare', url: 'https://tka-token.namaakun.workers.dev' },
],
```

Lalu jalankan ulang server lab dan `npx wrangler deploy` lagi, supaya kedua server memakai config yang sama.

**Buka admin dari server lab**, bukan dari Cloudflare. Halaman https (Cloudflare) diblokir browser saat mengirim ke alamat http (lab). Admin akan menulis keterangan ini sendiri kalau terjadi.

## Cara pakai saat TKA

1. Di TV/IFP: buka `/`, lalu fullscreen (F11 atau tombol fullscreen browser TV). TV di lab sebaiknya membuka alamat **server lab**, agar tetap jalan meski internet sekolah putus.
2. Di HP: buka `/admin`, masukkan PIN sekali.
3. Begitu menekan tombol token di situs TKA, ketik token di kartu SMK atau SMA, tekan **Simpan** (atau Enter).
4. Cek baris hasil: ✓ per server. Di bawahnya, isi tiap server dipantau tiap 5 detik. Muncul **beda!** kalau isi antar server tidak sama.

Hitung mundur 5 menit dimulai saat token disimpan, jadi sedikit lebih lambat dari hitungan di situs TKA. Saat tinggal 1 menit penanda berwarna kuning, dan saat habis berubah merah "Waktu habis" sebagai pengingat ganti token.

## Perilaku saat gangguan

- Server atau jaringan putus: token terakhir **tetap tampil**. Status pojok kanan atas berubah kuning ("mencoba lagi"), lalu merah setelah 30 detik ("data mungkin usang").
- Halaman TV memuat ulang sendiri tiap 1 jam, hanya ketika server terjangkau.
- PIN salah 10 kali dalam 10 menit dari alamat yang sama: diblokir 10 menit.
- Jam di layar memakai jam server dan zona WITA, jadi tetap benar walau jam TV salah.
