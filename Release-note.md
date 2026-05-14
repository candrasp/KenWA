# Release Notes - KenWa v1.1.0

## [1.1.0] - 2026-05-15

### 🚀 Fitur Baru
- **Auto-Initialization**: Aplikasi kini melakukan pengecekan dan pembuatan struktur folder `server/data/auth` secara otomatis di sisi Rust (Launcher) saat aplikasi pertama kali dibuka.
- **Custom Update Checker**: Implementasi sistem update baru yang mengecek rilis terbaru langsung ke GitHub API (`candrasp/KenWa`).
- **Portable Mode**: Seluruh penyimpanan data (SQLite & Sesi WhatsApp) dipindahkan ke direktori lokal aplikasi agar aplikasi dapat dijalankan dari folder mana pun (Portable).

### 🛠️ Perbaikan & Optimasi
- **Clean Terminal Logs**: Menyembunyikan log verbose dari `better-sqlite3` dan `Baileys` untuk tampilan terminal yang lebih bersih dan profesional.
- **Rust Setup Sync**: Proses inisialisasi dipindahkan ke tahap `setup` di Rust untuk memastikan kesiapan folder sebelum jendela UI ditampilkan.
- **Path Correction**: Memperbaiki urutan folder inisialisasi menjadi `server/data/auth`.

### ⚠️ Catatan Penting
- **Update Manual**: Karena aplikasi bersifat portabel, pembaruan dilakukan dengan mendownload ZIP terbaru dari GitHub dan menimpa folder `server` yang lama. Folder `data` akan tetap aman dan tidak akan terhapus.
- **Requirement**: Pastikan koneksi internet tersedia saat melakukan pengecekan update.

---
*KenWa - Solusi WhatsApp Blast Messaging yang Ringan dan Portabel.*
