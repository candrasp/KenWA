# KenWA — WhatsApp Blaster

> Tauri v2 · Express.js · Baileys · better-sqlite3 · Vanilla JS SPA

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
node index.js
# Buka browser: http://127.0.0.1:3721
```

### Development (Tauri)
```bash
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
