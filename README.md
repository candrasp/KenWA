# KenWA — WhatsApp Blaster

> Aplikasi Desktop Profesional untuk Broadcast WhatsApp (Tauri v2 · Express.js · Baileys · better-sqlite3 · Vanilla JS SPA)

## Tentang KenWA

KenWA adalah aplikasi desktop modern yang dirancang untuk membantu Anda mengirim pesan massal (blast) WhatsApp dengan mudah, cepat, dan aman. Menggunakan arsitektur *sidecar* Node.js yang ringan dipadukan dengan framework Tauri v2, KenWA menawarkan antarmuka pengguna yang sangat responsif, penggunaan resource komputer yang efisien, dan eksekusi background yang stabil.

## Fitur Utama

- **Koneksi Stabil & Auto-Reconnect**: Hubungkan WhatsApp semudah memindai QR code. Koneksi berjalan di latar belakang (background) dan dapat terhubung kembali secara otomatis saat jaringan terputus.
- **Manajemen Kontak & Tag**: Kelola daftar target Anda dengan mudah. Tambahkan kontak secara manual, via *import* Excel/CSV, atau sinkronisasi langsung dari akun WhatsApp. Gunakan sistem *Tags* (Label) untuk mengelompokkan kontak.
- **Pengiriman Pesan Massal (Blast)**:
  - **Variabel Dinamis**: Gunakan tag `{{nama}}` dalam teks untuk memberikan sentuhan personal pada setiap pesan.
  - **Filter Presisi**: Dukungan format khusus (`#tag`, `@kontak`, `@all`) pada form pengiriman untuk memilih target penerima dengan cepat.
  - **Keamanan Akun**: Pengaturan *Delay* dan *Random Delay* terintegrasi untuk meniru perilaku manusia, membantu menghindari deteksi spam dan menjaga akun Anda tetap aman.
- **Template Pesan**: Simpan dan kelola format pesan standar yang sering digunakan.
- **Riwayat & Monitoring Real-time**: Lacak secara real-time status pesan (Terkirim/Gagal) dan pantau log aktivitas aplikasi melalui dasbor intuitif.
- **Auto-Update (OTA)**: Sistem pembaruan terintegrasi yang memastikan Anda selalu menggunakan versi terbaru tanpa perlu mengunduh ulang secara manual.
- **UI/UX Premium**: Antarmuka mode gelap (Dark Mode) yang modern, bersih, dan profesional.


## Peringatan & Disclaimer

Gunakan aplikasi ini dengan bijak untuk menghindari risiko pemblokiran akun oleh WhatsApp. Segala bentuk penyalahgunaan, pemblokiran akun, atau kerugian yang timbul akibat penggunaan aplikasi ini adalah **tanggung jawab pengguna sepenuhnya**. Kami tidak bertanggung jawab atas dampak apa pun yang terjadi pada akun WhatsApp Anda.