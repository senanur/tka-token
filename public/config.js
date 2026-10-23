// Pengaturan halaman. Satu-satunya file yang perlu diubah per sekolah.
window.TKA_CONFIG = {
  // Zona waktu jam & "Diperbarui" (tidak bergantung pada setelan jam TV).
  timeZone: 'Asia/Makassar',

  // Server yang ditulis sekaligus oleh halaman admin.
  // url ''   = server tempat halaman admin ini sedang dibuka.
  // url null = belum diatur (dilewati).
  // Isi URL lengkap tiap server, contoh:
  //   { name: 'Server lab', url: 'http://token.labpplg.web.id' },
  //   { name: 'Cloudflare', url: 'https://tka-token.namaakun.workers.dev' },
  // Server yang alamatnya sama dengan halaman ini otomatis tidak ditulis dua kali.
  endpoints: [
    { name: 'Server lab', url: 'https://token.labpplg.web.id' },
    { name: 'Cloudflare', url: 'https://tka-token.acksyavi.workers.dev' },
  ],
};
