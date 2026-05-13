# KenWA — WhatsApp Blaster

> Aplikasi Desktop Profesional untuk Broadcast WhatsApp (Tauri v2 · Express.js · Baileys · better-sqlite3 · Vanilla JS SPA)

## Tentang KenWA

KenWA adalah aplikasi desktop modern yang dirancang untuk membantu Anda mengirim pesan massal (blast) WhatsApp dengan mudah, cepat, dan aman. Menggunakan arsitektur *sidecar* Node.js yang ringan dipadukan dengan framework Tauri v2, KenWA menawarkan antarmuka pengguna yang sangat responsif, penggunaan resource komputer yang efisien, dan eksekusi background yang stabil.

> [!CAUTION]
> **Peringatan Penting:** Gunakan aplikasi ini dengan bijak. Pengiriman pesan massal yang tidak bertanggung jawab dapat menyebabkan akun WhatsApp Anda diblokir. Segala bentuk risiko pemblokiran akun atau dampak hukum lainnya akibat penggunaan aplikasi ini adalah **tanggung jawab pengguna sepenuhnya**. Kami tidak bertanggung jawab atas kerugian yang ditimbulkan.

## Fitur Utama

- **Koneksi Stabil & Auto-Reconnect**: Hubungkan WhatsApp semudah memindai QR code. Koneksi berjalan di latar belakang (background) dan dapat terhubung kembali secara otomatis saat jaringan terputus.
- **Manajemen Kontak & Tag**: Kelola daftar target Anda dengan mudah. Tambahkan kontak secara manual, via *import* Excel/CSV, atau sinkronisasi langsung dari akun WhatsApp. Gunakan sistem *Tags* (Label) untuk mengelompokkan kontak.
- **Pengiriman Pesan Massal (Blast)**:
  - **Variabel Dinamis**: Gunakan tag `{{nama}}` dalam teks untuk memberikan sentuhan personal pada setiap pesan.
  - **Filter Presisi**: Dukungan format khusus (`#tag`, `@kontak`, `@all`) pada form pengiriman untuk memilih target penerima dengan cepat.
  - **Keamanan Akun**: Pengaturan *Delay* dan *Random Delay* terintegrated untuk meniru perilaku manusia, membantu menghindari deteksi spam dan menjaga akun Anda tetap aman.
- **Template Pesan**: Simpan dan kelola format pesan standar yang sering digunakan.
- **Riwayat & Monitoring Real-time**: Lacak secara real-time status pesan (Terkirim/Gagal) dan pantau log aktivitas aplikasi melalui dasbor intuitif.
- **Auto-Update (OTA)**: Sistem pembaruan terintegrasi yang memastikan Anda selalu menggunakan versi terbaru tanpa perlu mengunduh ulang secara manual.
- **UI/UX Premium**: Antarmuka mode gelap (Dark Mode) yang modern, bersih, dan profesional.

---

## Struktur Folder

```
KenWa/
├── src-tauri/              # Rust — hanya spawn sidecar & IPC commands
│   ├── src/lib.rs          # Builder + sidecar spawn + invoke_handler
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/       # Permissions Tauri v2
│
├── server/                 # Node.js backend — bisa dijalankan standalone
│   ├── index.js            # Entry: Express app
│   ├── routes/             # Endpoint definitions
│   ├── controllers/        # Request handling & validation
│   ├── services/           # Baileys WA logic + blast logic
│   ├── models/             # better-sqlite3 queries
│   └── utils/
│       ├── ipc.bridge.js   # Kirim event Node → Tauri
│       └── logger.js       # Pino logger
│
└── frontend/               # Vanilla JS SPA — no bundler
    ├── index.html
    ├── css/
    │   ├── variables.css   # Design tokens (import PERTAMA)
    │   └── main.css
    └── js/
        ├── main.js         # Entry: init router + IPC listeners
        ├── router.js       # Hash-based SPA router
        ├── pages/          # Dashboard, Login, Contacts, Blast, Settings
        ├── components/     # Sidebar, Toast, Modal
        └── services/
            ├── api.js      # Fetch wrapper ke Express
            └── ipc.js      # __TAURI__.invoke wrapper
```

## Cara Menjalankan

### Development (server standalone)
```bash
cd server
npm install
node index.js
# Buka browser: http://127.0.0.1:3721
```

### Development (Tauri)
```bash
npm install
npm run dev
# Tauri otomatis membuka window → server sudah jalan via beforeDevCommand
```

### Build Production
```bash
npm run build
```

## API Endpoints

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/health` | Health check |
| GET | `/api/wa` | Status koneksi WA |
| POST | `/api/wa/connect` | Mulai koneksi WA (QR via IPC) |
| POST | `/api/wa/disconnect` | Logout WA |
| GET | `/api/contacts` | Daftar kontak |
| POST | `/api/contacts` | Tambah kontak |
| PUT | `/api/contacts/:id` | Update kontak |
| DELETE | `/api/contacts/:id` | Hapus kontak |
| GET | `/api/blast/templates` | Template blast |
| POST | `/api/blast/start` | Mulai blast |
| GET | `/api/blast/history` | Riwayat blast |

## IPC Events (Node → Tauri → Frontend)

| Event | Payload | Deskripsi |
|-------|---------|-----------|
| `wa:qr` | `{ qr: "data:image/..." }` | QR Code baru |
| `wa:ready` | `{ user, ts }` | WA terkoneksi |
| `wa:disconnected` | `{ reason }` | WA disconnect |
| `blast:progress` | `{ historyId, sent, failed, total, percent }` | Progress blast |
| `blast:done` | `{ historyId, sent, failed, total, status }` | Blast selesai |

---

## Peringatan & Disclaimer

Gunakan aplikasi ini dengan bijak untuk menghindari risiko pemblokiran akun oleh WhatsApp. Segala bentuk penyalahgunaan, pemblokiran akun, atau kerugian yang timbul akibat penggunaan aplikasi ini adalah **tanggung jawab pengguna sepenuhnya**. Kami tidak bertanggung jawab atas dampak apa pun yang terjadi pada akun WhatsApp Anda.