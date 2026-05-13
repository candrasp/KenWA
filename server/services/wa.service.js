'use strict';

const path       = require('path');
const fs         = require('fs');
const qrcode     = require('qrcode');
const IPCBridge  = require('../utils/ipc.bridge');
const logger     = require('../utils/logger');

const AUTH_FOLDER   = path.join(__dirname, '..', 'data', 'auth');
const CONTACTS_FILE = path.join(__dirname, '..', 'data', 'contacts.json');

let sock          = null;
let isConnected   = false;
let waUserProfile = null;
let sessionUser   = null; // Persisted user session (even when reconnecting)
let contacts      = {}; // In-memory contact store
let syncProgress  = 100;
let hasLoggedLogin = false; // Flag agar tidak spam log saat reconnecting

// ── Persistência Kontak ────────────────────────────────────────────────────────
if (fs.existsSync(CONTACTS_FILE)) {
  try {
    contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8'));
    logger.info(`[WA] Memuat ${Object.keys(contacts).length} kontak dari cache.`);
  } catch (e) {
    logger.warn('[WA] Gagal membaca cache kontak, mulai kosong.');
    contacts = {};
  }
}

function saveContacts() {
  try {
    const dir = path.dirname(CONTACTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  } catch (e) {
    logger.error('[WA] Gagal menyimpan cache kontak:', e.message);
  }
}

// ── Tambahkan kontak ke store ────────────────────────────────────────────────
function upsertContacts(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  list.forEach(c => {
    if (!c || !c.id) return;
    
    // Simpan data mentah
    contacts[c.id] = Object.assign(contacts[c.id] || {}, c);

    // Jika ini adalah LID yang punya mapping ke Phone Number, simpan juga JID aslinya
    if (c.id.endsWith('@lid') && c.phoneNumber) {
      const phoneJid = c.phoneNumber;
      contacts[phoneJid] = Object.assign(contacts[phoneJid] || {}, { 
        id: phoneJid, 
        name: c.name || c.notify || c.verifiedName 
      });
    }
  });
  saveContacts();
}

// ── Cleanup socket lama sebelum buat yang baru ────────────────────────────────
function cleanupSocket() {
  if (sock) {
    try { sock.ev.removeAllListeners(); } catch (_) {}
    try { sock.end(); } catch (_) {}
    sock = null;
    logger.info('[WA] Socket lama dibersihkan.');
  }
}

// ── Connect ──────────────────────────────────────────────────────────────────
async function connect() {
  try {
    cleanupSocket(); // Bersihkan socket lama sebelum membuat baru
    logger.info('[WA] Memulai koneksi...');

    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }

    // Dynamic import — wajib karena Baileys v7 adalah pure ESM
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      Browsers,
      fetchLatestBaileysVersion,
    } = await import('@whiskeysockets/baileys');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    syncProgress = 0;

    let version = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version;
      logger.info(`[WA] Menggunakan WA v${version.join('.')} (isLatest: ${latest.isLatest})`);
    } catch (e) {
      logger.warn('[WA] Gagal mengambil versi WA terbaru, pakai fallback.');
    }

    sock = makeWASocket({
      version,
      auth:                     state,
      printQRInTerminal:        false,
      logger:                   logger.child({ module: 'baileys' }),
      browser:                  Browsers.macOS('Desktop'),
      syncFullHistory:          true,
      markOnlineOnConnect:      false,
      defaultQueryTimeoutMs:    3600000,
      connectTimeoutMs:         120000,
      keepAliveIntervalMs:      60000,
      retryRequestDelayMs:      5000,
      generateHighQualityLinkPreview: false,
      // v7: shouldSyncHistoryMessage menerima historyMsg object
      shouldSyncHistoryMessage: (_msg) => true,
    });

    // ── Event: History sync (batch awal saat login) ──────────────────────────
    sock.ev.on('messaging-history.set', ({ contacts: c, isLatest, progress }) => {
      logger.info(`[WA] messaging-history.set: ${c?.length ?? 0} kontak, progress: ${progress ?? '?'}%, isLatest: ${isLatest}`);
      if (c && c.length > 0) upsertContacts(c);
      if (typeof progress === 'number') syncProgress = progress;
      if (isLatest) {
        syncProgress = 100;
        logger.info(`[WA] History sync selesai. Total kontak di memori: ${Object.keys(contacts).length}`);
      }
    });

    // ── Event: Kontak baru masuk (individual atau batch) ────────────────────
    sock.ev.on('contacts.upsert', (c) => upsertContacts(c));
    sock.ev.on('contacts.update', (updates) => {
      if (!Array.isArray(updates)) return;
      updates.forEach(u => {
        if (!u || !u.id) return;
        contacts[u.id] = Object.assign(contacts[u.id] || {}, u);
        
        // Handle LID update mapping
        if (u.id.endsWith('@lid') && u.phoneNumber) {
          const phoneJid = u.phoneNumber;
          contacts[phoneJid] = Object.assign(contacts[phoneJid] || {}, { 
            id: phoneJid,
            name: u.name || u.notify || u.verifiedName
          });
        }
      });
      saveContacts();
    });

    sock.ev.on('creds.update', saveCreds);

    // ── Event: Koneksi berubah ───────────────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try {
          const qrDataUrl = await qrcode.toDataURL(qr);
          IPCBridge.qr(qrDataUrl);
          logger.info('[WA] QR code digenerate, menunggu scan...');
        } catch (e) {
          logger.error('[WA] Gagal generate QR:', e.message);
        }
      }

      if (connection === 'open') {
        isConnected   = true;
        waUserProfile = { ...sock.user, img: null };
        sessionUser   = waUserProfile; // Simpan ke session memory
        
        try {
          if (!hasLoggedLogin) {
            const { ActivityLog } = require('../models/activity.model');
            const userId = waUserProfile.id.split(':')[0].split('@')[0];
            const userName = waUserProfile.name || waUserProfile.notify || waUserProfile.verifiedName || userId;
            ActivityLog.create({ user_id: userId, type: 'login', message: `Login WhatsApp: ${userName}` });
            IPCBridge.emit('broadcast', { type: 'ACTIVITY_UPDATE' });
            hasLoggedLogin = true;
          }
        } catch (err) {
          logger.error({ err }, '[WA] Gagal simpan activity log login');
        }

        IPCBridge.ready({ user: waUserProfile, ts: Date.now() });
        logger.info({ user: sock.user }, '[WA] Terhubung!');

        // Ambil foto profil secara async
        (async () => {
          try {
            await new Promise(r => setTimeout(r, 2000));
            waUserProfile.img = await sock.profilePictureUrl(sock.user.id, 'image');
            IPCBridge.ready({ user: waUserProfile, ts: Date.now() });
          } catch (_) { /* foto profil tidak wajib */ }
        })();
      }

      if (connection === 'close') {
        isConnected = false;
        const { Boom } = await import('@hapi/boom');
        const error  = lastDisconnect?.error;
        const reason = error ? (new Boom(error)?.output?.statusCode ?? 500) : 500;
        
        // Cek jika ini adalah Stream Error (fatal) yang butuh restart koneksi
        const isStreamError = error?.message?.includes('Stream Errored');
        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        logger.warn({ reason, error: error?.message, isStreamError }, '[WA] Koneksi terputus');
        
        // Kirim status terputus ke frontend dengan flag temporary
        IPCBridge.disconnected({ 
          reason, 
          isTemporary: shouldReconnect || isStreamError 
        });

        if (reason === DisconnectReason.loggedOut) {
          logger.info('[WA] Logout berhasil.');
          sessionUser = null; // Hapus session jika benar-benar logout
        } else if (reason === 401 || reason === 405) {
          logger.warn('[WA] Sesi kadaluarsa. Menghapus folder auth...');
          sessionUser = null; // Hapus session jika sesi tidak valid
          if (fs.existsSync(AUTH_FOLDER)) {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
          }
        }

        if (shouldReconnect || isStreamError) {
          // Stream error butuh delay lebih lama agar server WA siap menerima koneksi baru
          const delay = isStreamError ? 8000 : 5000;
          logger.info(`[WA] Reconnect dalam ${delay / 1000} detik...`);
          setTimeout(() => connect().catch(e => logger.error(e, '[WA] Reconnect gagal')), delay);
        }
      }
    });

  } catch (err) {
    logger.error(err, '[WA] Gagal koneksi (critical)');
    setTimeout(() => connect().catch(e => logger.error(e, '[WA] Retry gagal')), 10000);
  }
}

// ── Disconnect / Logout ───────────────────────────────────────────────────────
async function disconnect() {
  logger.info('[WA] Logout diminta...');
  if (sock) {
    try { await sock.logout(); } catch (_) {
      try { sock.end(); } catch (_) {}
    }
    sock        = null;
    isConnected = false;
    sessionUser = null; // Hapus session saat logout manual
    hasLoggedLogin = false;
  }
  if (fs.existsSync(AUTH_FOLDER)) {
    try {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      logger.info('[WA] Folder auth dihapus.');
    } catch (e) {
      logger.error('[WA] Gagal hapus folder auth:', e.message);
    }
  }
}

// ── Kirim pesan teks ─────────────────────────────────────────────────────────
async function sendText(phone, message) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');
  return sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
}

// ── Status koneksi ────────────────────────────────────────────────────────────
function getStatus() {
  return {
    connected:    isConnected,
    user:         isConnected ? waUserProfile : null,
    sessionUser, // Kirim data session terakhir
    syncProgress,
    contactCount: Object.keys(contacts).length,
  };
}

// ── Cek nomor di WhatsApp ─────────────────────────────────────────────────────
async function onWhatsApp(phone) {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  const [result] = await sock.onWhatsApp(jid);
  return result?.exists ? result : null;
}

// ── Sync kontak ke database ───────────────────────────────────────────────────
async function syncContacts() {
  if (!sock || !isConnected) throw new Error('WhatsApp not connected');

  const rawContacts = Object.values(contacts);
  logger.info(`[WA] Sync: Total kontak di memori = ${rawContacts.length}`);

  const results = [];
  rawContacts.forEach(c => {
    if (!c.id) return;

    // Abaikan secara eksplisit: grup, broadcast, dan ID tidak dikenal
    if (
      c.id.endsWith('@g.us')        || // grup WhatsApp
      c.id.endsWith('@broadcast')   || // status broadcast
      c.id.endsWith('@newsletter')  || // newsletter WA
      c.id === '0@s.whatsapp.net'      // dummy/system ID
    ) return;

    // Ambil nomor HP:
    // 1. JID standar (@s.whatsapp.net) → ambil bagian sebelum @
    // 2. LID (@lid) dengan field phoneNumber → ambil nomor dari phoneNumber
    let phone = null;
    if (c.id.endsWith('@s.whatsapp.net')) {
      phone = c.id.split('@')[0];
    } else if (c.id.endsWith('@lid') && c.phoneNumber) {
      phone = c.phoneNumber.split('@')[0];
    }

    // Lewati jika nomor tidak valid
    if (!phone || phone === '0') return;

    // Ambil nama (prioritas: name, lalu notify)
    const name = c.name || c.notify;
    
    // Jika tidak punya nama atau notify, jangan simpan ke database (sesuai request)
    if (!name) return;

    // Hindari duplikat di hasil akhir
    if (!results.find(r => r.phone === phone)) {
      results.push({ name, phone });
    }
  });

  return results;
}

module.exports = { connect, disconnect, sendText, getStatus, onWhatsApp, syncContacts };
