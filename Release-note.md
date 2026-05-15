# Release Notes - KenWa
Current Version: v1.1.2

## [1.1.2] - 2026-05-15

### 🚀 Fitur Baru
- **Interactive Help Guide**: Menambahkan tombol bantuan (`?`) di launcher yang berisi panduan langkah-demi-langkah penggunaan aplikasi.
- **Server Health Monitor**: Implementasi logika pendeteksi status server pada dashboard. Jika koneksi ke backend terputus, aplikasi akan menampilkan modal peringatan secara otomatis.
- **Improved UI Indicators**: Indikator **SRV** pada launcher kini secara cerdas akan mati (dark mode) saat server sedang offline, memberikan umpan balik visual yang lebih akurat.

### 🛠️ Perbaikan & Optimasi
- **Modal UX Refinement**: Optimasi layout modal bantuan dengan fungsi *scrolling* dan penyesuaian ukuran tombol agar lebih proporsional.
- **Process Management Documentation**: Menambahkan instruksi penutupan aplikasi melalui **System Tray** di panduan bantuan untuk mencegah adanya *zombie processes*.
- **Layout Adjustments**: Memperluas area terminal log pada launcher untuk visibilitas monitoring yang lebih baik.

---

## [1.1.0] - 2026-05-15

### 🚀 Fitur Baru
- **Auto-Initialization**: Aplikasi kini melakukan pengecekan dan pembuatan struktur folder `server/data/auth` secara otomatis di sisi Rust (Launcher).
- **Custom Update Checker**: Implementasi sistem update baru yang mengecek rilis terbaru langsung ke GitHub API.
- **Portable Mode**: Seluruh penyimpanan data dipindahkan ke direktori lokal aplikasi agar aplikasi dapat dijalankan secara portabel.

### 🛠️ Perbaikan & Optimasi
- **Clean Terminal Logs**: Menyembunyikan log verbose untuk tampilan yang lebih profesional.
- **Rust Setup Sync**: Proses inisialisasi dipindahkan ke tahap `setup` di Rust.
- **Path Correction**: Memperbaiki urutan folder inisialisasi menjadi `server/data/auth`.

### ⚠️ Catatan Penting
- **Update Manual**: Pembaruan dilakukan dengan mendownload ZIP terbaru dari GitHub dan menimpa folder `server`. Folder `data` akan tetap aman.

---
*KenWa - Solusi WhatsApp Blast Messaging yang Ringan dan Portabel.*
