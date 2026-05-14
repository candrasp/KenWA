# Rancangan Struktur Folder — KenWa

**KenWa** adalah aplikasi **WhatsApp Blast Messaging** yang terdiri dari dua komponen utama:
1. **`tauri-app.exe`** — GUI Launcher berbasis Tauri (start/stop server Node.js)
2. **Server Node.js** — Backend REST API + WhatsApp engine, diakses melalui **web browser** oleh pengguna

> Tidak ada mekanisme sidecar/bundling. Server Node.js berjalan sebagai proses mandiri yang dikontrol oleh launcher.

---

## Gambaran Arsitektur

```
┌──────────────────────────────────────────────────────────────┐
│                    Komputer Pengguna                         │
│                                                              │
│  ┌─────────────────────┐       start/stop         ┌────────┐ │
│  │  tauri-app.exe      │ ──────────────────────►  │        │ │
│  │  (GUI Launcher)     │                          │ server/│ │
│  │                     │ ◄──── log streaming ──── │ Node.js│ │
│  │  [Start Server]     │                          │ :3721  │ │
│  │  [Stop Server]      │                          └────────┘ │
│  │  [Buka WhatsApp] ───┼──► membuka browser                  │
│  └─────────────────────┘         │                           │
│                                  ▼                           │
│                    ┌─────────────────────────┐               │
│                    │  Web Browser Pengguna   │               │
│                    │  http://localhost:3721  │               │
│                    │                         │               │
│                    │  frontend/ (Dashboard)  │               │
│                    └─────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    WhatsApp Web Servers
```

---

## Struktur Folder Lengkap

```
KenWa/                          ← Root project (source code / development)
├── src-tauri/                  ← Source code Tauri (Rust) untuk build launcher
├── src/                        ← UI launcher (WebView Tauri)
├── server/                     ← Backend Node.js (REST API + WhatsApp)
├── frontend/                   ← Web dashboard (diakses via browser)
├── data/                       ← Database root level
├── runtime/                    ← Binary Node.js bundled
├── package.json
└── ...

Kenwa-final/                    ← Folder distribusi production (tanpa build tools)
├── tauri-app.exe               ← GUI Launcher siap pakai
├── server/                     ← Server Node.js production
├── frontend/                   ← Web dashboard production
└── runtime/                    ← Binary Node.js bundled
```

---

## 1. `tauri-app.exe` — GUI Launcher

File executable tunggal hasil build dari `/src-tauri`. Ini adalah **satu-satunya** antarmuka desktop yang diinstal pengguna. Tugasnya hanya:

- Menampilkan panel kontrol server (start / stop)
- Menjalankan `runtime/node/node.exe server/index.js` sebagai proses anak
- Meneruskan log stdout server ke panel terminal bawaan
- Membuka browser pengguna ke `http://localhost:3721` via tombol **"Buka WhatsApp"**
- Menampilkan indikator status server (LED online/offline, grafik traffic simulasi)

> **Penting:** `tauri-app.exe` **tidak** menampilkan dashboard. Dashboard tetap berjalan di browser pengguna.

---

## 2. `/src-tauri` — Source Code Launcher (Rust)

Source code Rust yang dikompilasi menjadi `tauri-app.exe`. Hanya relevan saat development/build.

```
src-tauri/
├── src/
│   ├── main.rs             ← Entry point Rust
│   └── lib.rs              ← Logika launcher: spawn server Node.js,
│                              baca stdout, kirim event ke WebView,
│                              handle start/stop dari UI
├── capabilities/
│   └── default.json        ← Izin Tauri v2 (shell:allow-spawn, dll.)
├── permissions/            ← Definisi permission kustom
├── icons/                  ← Ikon aplikasi (.png, .ico, .icns)
├── gen/                    ← File auto-generated Tauri
├── target/                 ← Output build Rust (diabaikan Git, ~GB)
├── Cargo.toml              ← Dependency Rust
├── Cargo.lock              ← Lock file Rust
├── build.rs                ← Script build Tauri
└── tauri.conf.json         ← Konfigurasi window launcher:
                               ukuran 500x400, tidak resizable,
                               tidak maximizable
```

### Konfigurasi Window (`tauri.conf.json`)
| Parameter | Nilai | Keterangan |
|---|---|---|
| `width` | `500` | Lebar window launcher (px) |
| `height` | `400` | Tinggi window launcher (px) |
| `resizable` | `false` | Tidak bisa diubah ukurannya |
| `maximizable` | `false` | Tidak bisa dimaksimalkan |
| `center` | `true` | Tampil di tengah layar |
| `frontendDist` | `../src` | Folder UI WebView |

---

## 3. `/src` — UI Launcher (WebView Tauri)

Antarmuka visual dari `tauri-app.exe` yang di-render di dalam WebView Tauri. Ini bukan web app yang diakses browser — ini adalah tampilan **di dalam jendela launcher** itu sendiri.

```
src/
├── index.html          ← Panel kontrol launcher:
│                          - Tombol "Start Server" / "Stop Server"
│                          - Tombol "Buka WhatsApp" (buka browser)
│                          - Panel terminal log output
│                          - Indikator LED status server
│                          - Grafik traffic animasi (dekoratif)
│                          - Error modal jika node.exe tidak ditemukan
├── main.js             ← (tidak ada, logic embed di index.html)
├── styles.css          ← Styling dark-theme hardware aesthetic (1U rack)
└── assets/
    ├── tauri.svg
    └── javascript.svg
```

### Alur Kerja UI Launcher:
```
User klik [Start Server]
    → emit('start-server') ke Rust
    → Rust spawn: runtime/node/node.exe server/index.js
    → stdout server di-pipe ke event 'server-log'
    → UI update: LED hijau, tombol berubah jadi "Stop Server"

User klik [Buka WhatsApp]
    → emit('open-browser', 'http://localhost:3721')
    → Rust buka default browser di URL tersebut

User klik [Stop Server]
    → emit('stop-server') ke Rust
    → Rust kill proses Node.js
    → UI update: LED merah, tombol kembali "Start Server"
```

---

## 4. `/server` — Backend Node.js

Server Express.js yang dijalankan oleh launcher. Menyediakan REST API dan mengelola koneksi WhatsApp via **Baileys**. Diakses di `http://localhost:3721`.

```
server/
├── index.js                ← Entry point: inisialisasi Express, mount routes,
│                              setup SSE untuk log streaming ke launcher
├── global-config.js        ← Feature flags (dev/production), versi app
├── server.log              ← Log output server (⚠ bisa tumbuh besar)
│
├── controllers/            ← Handler logika bisnis per fitur
│   ├── activity.controller.js  ← Ambil & catat log aktivitas dashboard
│   ├── blast.controller.js     ← Eksekusi blast message ke banyak kontak
│   ├── contact.controller.js   ← CRUD kontak, import CSV, sinkronisasi WA
│   ├── setting.controller.js   ← Baca & simpan konfigurasi (delay, dll.)
│   ├── tag.controller.js       ← Manajemen tag/label kontak
│   └── wa.controller.js        ← Status WA, QR code, reboot sesi
│
├── models/                 ← Layer database (SQLite via better-sqlite3)
│   ├── db.js               ← Inisialisasi & koneksi SQLite
│   ├── schema.js           ← Definisi tabel + migrasi otomatis
│   ├── activity.model.js   ← Query tabel activity_log
│   ├── blast.model.js      ← Query tabel blast_history & blast_templates
│   ├── contact.model.js    ← Query tabel contacts (filter, pagination, tag)
│   ├── setting.model.js    ← Query tabel settings (key-value per user)
│   └── tag.model.js        ← Query tabel tags & contact_tags
│
├── routes/                 ← Definisi endpoint REST API
│   ├── activity.routes.js  ← GET  /api/activity
│   ├── blast.routes.js     ← POST /api/blast/send
│   │                          GET  /api/blast/history
│   ├── contact.routes.js   ← GET/POST/PUT/DELETE /api/contacts
│   │                          POST /api/contacts/import
│   │                          POST /api/contacts/verify
│   ├── setting.routes.js   ← GET/POST /api/settings
│   ├── tag.routes.js       ← GET/POST/DELETE /api/tags
│   └── wa.routes.js        ← GET  /api/wa/status
│                              GET  /api/wa/qr
│                              POST /api/wa/reboot
│                              GET  /api/config
│
├── services/               ← Layanan inti aplikasi
│   ├── wa.service.js       ← Koneksi WhatsApp via Baileys (WebSocket):
│   │                          login, generate QR, kirim pesan, sesi
│   └── blast.service.js    ← Orkestrasi blast: iterasi kontak, delay,
│                              update status per penerima
│
├── utils/                  ← Fungsi utilitas
│   ├── ipc.bridge.js       ← Emit data ke launcher via console.log / SSE
│   └── logger.js           ← Wrapper logger (pino) → server.log
│
├── data/                   ← Data persisten runtime
│   ├── kenwa.db            ← Database SQLite utama
│   ├── kenwa.db-shm        ← Shared memory WAL
│   ├── kenwa.db-wal        ← Write-Ahead Log SQLite
│   ├── contacts.json       ← Cache daftar kontak WhatsApp
│   └── auth/               ← ⚠ Sesi Baileys (JANGAN commit ke Git!)
│       ├── creds.json          ← Kredensial akun WA (login persisten)
│       ├── pre-key-*.json      ← Pre-keys enkripsi Signal Protocol (800+ file)
│       ├── session-*.json      ← Sesi enkripsi per kontak
│       ├── lid-mapping-*.json  ← Mapping ID kontak WhatsApp
│       └── app-state-sync-*.json ← State sinkronisasi WA
│
├── package.json            ← Dependency: baileys, express, better-sqlite3, dll.
└── node_modules/           ← Modul npm (diabaikan Git)
```

---

## 5. `/frontend` — Web Dashboard (SPA)

Aplikasi web yang **dilayani oleh server Node.js** dan diakses pengguna melalui **browser** di `http://localhost:3721`. Ini adalah antarmuka utama aplikasi KenWa.

```
frontend/
├── index.html              ← Shell HTML utama (Single Page Application)
│
├── css/                    ← Stylesheet modular
│   ├── variables.css       ← CSS custom properties (warna, spacing, font)
│   ├── main.css            ← Layout: sidebar, content area, komponen global
│   ├── blast.css           ← Style khusus halaman Blast Messaging
│   ├── settings.css        ← Style khusus halaman Settings
│   ├── global-progress.css ← Progress bar animasi untuk operasi panjang
│   └── boxicons.min.css    ← Icon library (Box Icons, bundled lokal)
│
├── js/
│   ├── main.js             ← Entry point: inisialisasi app, cek auth, routing
│   ├── router.js           ← Client-side router (SPA navigation)
│   │
│   ├── pages/              ← Satu file per halaman aplikasi
│   │   ├── Login.js        ← Scan QR Code WhatsApp untuk login
│   │   ├── Dashboard.js    ← Statistik, activity feed, chart traffic
│   │   ├── Contacts.js     ← Manajemen kontak: tabel, import CSV, filter tag
│   │   ├── Blast.js        ← Blast messaging: compose, pilih penerima, kirim
│   │   ├── History.js      ← Riwayat blast message yang terkirim
│   │   ├── Settings.js     ← Konfigurasi delay, info versi, update
│   │   └── Help.js         ← FAQ dan panduan penggunaan
│   │
│   ├── components/         ← Komponen UI yang digunakan ulang
│   │   ├── Sidebar.js      ← Navigasi sidebar dengan highlight halaman aktif
│   │   ├── Modal.js        ← Dialog/modal generik
│   │   ├── Table.js        ← Tabel data dengan sorting & pagination
│   │   ├── Toast.js        ← Notifikasi toast (sukses / error / warning)
│   │   └── global-progress.js ← Progress bar global (atas layar)
│   │
│   ├── services/           ← Layer komunikasi dengan server
│   │   ├── api.js          ← Wrapper `fetch` untuk semua panggilan REST API
│   │   └── ipc.js          ← (Tidak dipakai di browser, placeholder)
│   │
│   └── lib/
│       └── chart.js        ← Chart.js (bundled lokal, untuk grafik dashboard)
│
└── img/
    └── logo.png            ← Logo KenWa
```

---

## 6. `/runtime` — Node.js Binary

Berisi `node.exe` yang dibundel bersama aplikasi. Launcher menggunakan binary ini untuk menjalankan server tanpa memerlukan Node.js terinstal di komputer pengguna.

```
runtime/
└── node/
    └── node.exe            ← Binary Node.js (~83 MB), dieksekusi oleh launcher
```

**Cara launcher menjalankan server:**
```
runtime/node/node.exe  server/index.js
      ↑                       ↑
  binary Node.js         entry point server
```

---

## 7. `/data` — Database Root Level

```
data/
└── app.db              ← SQLite sekunder (data konfigurasi level aplikasi)
```

> Database utama (`kenwa.db`) berada di `server/data/`.

---

## 8. File & Folder di Root

| File/Folder | Fungsi |
|---|---|
| `package.json` | Dependency root & script Tauri dev |
| `package-lock.json` | Lock file npm root |
| `node_modules/` | Modul npm root (diabaikan Git) |
| `.gitignore` | Exclusi Git: `node_modules/`, `auth/`, `*.log`, `target/` |
| `README.md` | Dokumentasi utama project |
| `logo.png` | Aset logo |
| `promt.txt` | Catatan pengembangan (tidak masuk production) |
| `.vscode/` | Konfigurasi editor VS Code |
| `.git/` | Repository Git |

---

## 9. Skema Database (`kenwa.db`)

Semua tabel dibuat otomatis saat pertama kali server dijalankan (`server/models/schema.js`).

### Tabel: `contacts`
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `user_id` | TEXT | Nomor WA pemilik (multi-akun ready) |
| `name` | TEXT | Nama kontak |
| `phone` | TEXT | Nomor telepon (format internasional) |
| `verification_status` | INTEGER | `0`=belum, `1`=valid WA, `2`=gagal |
| `notes` | TEXT | Catatan bebas |
| `created_at` | TEXT | Waktu dibuat |

### Tabel: `tags`
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `user_id` | TEXT | Pemilik tag |
| `name` | TEXT | Nama tag (unik per user) |
| `description` | TEXT | Deskripsi tag |

### Tabel: `contact_tags` (pivot)
| Kolom | Tipe | Keterangan |
|---|---|---|
| `contact_id` | INTEGER FK | → `contacts.id` |
| `tag_id` | INTEGER FK | → `tags.id` |

### Tabel: `blast_templates`
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `user_id` | TEXT | Pemilik template |
| `name` | TEXT | Nama template |
| `body` | TEXT | Isi pesan (mendukung variabel `{name}`, dll.) |
| `created_at` | TEXT | Waktu dibuat |

### Tabel: `blast_history`
Log pengiriman per penerima.

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `user_id` | TEXT | Pengirim |
| `name` | TEXT | Nama penerima |
| `phone` | TEXT | Nomor penerima |
| `message` | TEXT | Isi pesan terkirim |
| `status` | TEXT | `pending` / `success` / `failed` |
| `created_at` | TEXT | Waktu kirim |
| `updated_at` | TEXT | Waktu update status |

### Tabel: `settings`
| Kolom | Tipe | Default | Keterangan |
|---|---|---|---|
| `user_id` | TEXT | — | Unik per akun WA |
| `blast_delay` | INTEGER | `7000` | Jeda antar pesan (ms) |
| `verification_delay` | INTEGER | `5000` | Jeda antar verifikasi (ms) |
| `random_blast_delay` | INTEGER | `2000` | Jeda acak tambahan blast (ms) |
| `random_verification_delay` | INTEGER | `2000` | Jeda acak tambahan verifikasi (ms) |

### Tabel: `activity_log`
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | INTEGER PK | Auto increment |
| `user_id` | TEXT | Akun terkait |
| `type` | TEXT | `login`, `blast`, `contact`, dll. |
| `message` | TEXT | Deskripsi aktivitas |
| `created_at` | TEXT | Waktu kejadian |

---

## 10. Referensi REST API

Server berjalan di `http://localhost:3721`. Semua endpoint diawali `/api/`.

### WhatsApp
| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/wa/status` | Status koneksi WA |
| `GET` | `/api/wa/qr` | QR code login (base64 PNG) |
| `POST` | `/api/wa/reboot` | Restart sesi WA |
| `GET` | `/api/config` | Konfigurasi aktif & versi aplikasi |

### Kontak
| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/contacts` | List kontak (filter, pagination) |
| `POST` | `/api/contacts` | Tambah kontak |
| `PUT` | `/api/contacts/:id` | Update kontak |
| `DELETE` | `/api/contacts/:id` | Hapus kontak |
| `POST` | `/api/contacts/import` | Import dari CSV |
| `POST` | `/api/contacts/sync` | Sinkronisasi dari WA |
| `POST` | `/api/contacts/verify` | Verifikasi nomor aktif WA |

### Tag
| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/tags` | List tag |
| `POST` | `/api/tags` | Buat tag baru |
| `DELETE` | `/api/tags/:id` | Hapus tag |

### Blast
| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/blast/send` | Kirim blast message |
| `GET` | `/api/blast/history` | Riwayat pengiriman |
| `GET` | `/api/blast/templates` | List template |
| `POST` | `/api/blast/templates` | Simpan template |

### Aktivitas & Settings
| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/api/activity` | Log aktivitas dashboard |
| `GET` | `/api/settings` | Baca konfigurasi delay |
| `POST` | `/api/settings` | Simpan konfigurasi delay |

---

## 11. Dependensi

### Server (`server/package.json`) — v1.1.0
| Package | Versi | Fungsi |
|---|---|---|
| `@whiskeysockets/baileys` | `^7.0.0-rc10` | Koneksi WhatsApp Web (inti) |
| `better-sqlite3` | `^11.9.1` | Driver SQLite sinkron |
| `express` | `^4.21.2` | REST API framework |
| `cors` | `^2.8.5` | Middleware CORS |
| `pino` + `pino-pretty` | `^9.7.0` | Logger performa tinggi |
| `qrcode` | `^1.5.4` | Generate QR code |
| `nodemon` *(dev)* | `^3.1.0` | Auto-restart development |

### Launcher (`src-tauri/Cargo.toml`) — Rust
| Crate | Fungsi |
|---|---|
| `tauri` | Desktop framework (WebView + IPC) |
| `serde` / `serde_json` | Serialisasi JSON |
| `tauri-plugin-shell` | Spawn & kontrol proses Node.js |

---

## 12. Feature Flags (`server/global-config.js`)

Dikontrol oleh `NODE_ENV`. Tidak memerlukan file `.env`.

| Flag | Dev | Production | Keterangan |
|---|---|---|---|
| `right_click` | `true` | `true`* | Klik kanan di dashboard browser |
| `inspect_element` | `true` | `true`* | Dev tools shortcut |
| `update_enabled` | `false` | `true` | Tampil tombol "Update Software" |
| `debug_log` | `true` | `false` | Verbose logging ke server.log |
| `version` | `1.1.0` | `1.1.0` | Versi app di footer dashboard |

> \* Ubah ke `false` untuk hardening sebelum distribusi ke pengguna akhir.

---

## 13. Alur Development & Build

### Development
```bash
# Terminal 1 — jalankan server backend
cd server
node index.js
# Server berjalan di http://localhost:3721

# Terminal 2 — buka dashboard di browser
# Akses langsung: http://localhost:3721

# (Opsional) Jalankan Tauri dev untuk test launcher
npm run tauri dev
```

### Build Production (distribusi `Kenwa-final/`)
```
Langkah 1: Build launcher
  npm run tauri build
  → Output: src-tauri/target/release/tauri-app.exe

Langkah 2: Susun folder distribusi
  Kenwa-final/
  ├── tauri-app.exe         ← hasil build Tauri
  ├── server/               ← copy folder server/ (tanpa node_modules dev)
  ├── frontend/             ← copy folder frontend/
  └── runtime/node/node.exe ← binary Node.js
```

> Pengguna akhir hanya perlu folder `Kenwa-final/`. Mereka tidak butuh Node.js, tidak butuh npm — semua sudah ada di dalam folder.

---

## 14. Catatan Penting

> [!WARNING]
> **Jangan commit** folder `server/data/auth/` ke Git! Berisi `creds.json` (kredensial sesi WhatsApp) yang bersifat sangat sensitif.

> [!WARNING]
> **`server.log`** dapat tumbuh sangat besar (ratusan MB) seiring penggunaan. Bersihkan secara berkala.

> [!NOTE]
> Port default server adalah **3721**. Pastikan tidak ada aplikasi lain yang menggunakan port ini. Port dapat diubah di `server/global-config.js`.

> [!TIP]
> Untuk pengembangan frontend, cukup jalankan `node server/index.js` lalu akses `http://localhost:3721` di browser. Tidak perlu build Tauri untuk iterasi UI.
