/**
 * KenWA — App Entry Point
 * Inisialisasi sidebar, router, dan Tauri event listeners.
 */

import Router    from './router.js';
import Sidebar   from './components/Sidebar.js';
import IPC       from './services/ipc.js';

// ── Global State ───────────────────────────────────────────────────────────
window.isWaConnected    = false;
window.isWaReconnecting = false;
window.waUser           = null;

// ── Daftarkan semua halaman ────────────────────────────────────────────────
Router.register('/dashboard', () => import('./pages/Dashboard.js'));
Router.register('/login',     () => import('./pages/Login.js'));
Router.register('/contacts',  () => import('./pages/Contacts.js'));
Router.register('/blast',     () => import('./pages/Blast.js'));
Router.register('/settings',  () => import('./pages/Settings.js'));

// ── Auth Guard Logic ───────────────────────────────────────────────────────
Router.beforeEach(async (to) => {
  // Selalu izinkan ke halaman login
  if (to === '/login') return true;

  // Jika belum terkoneksi DAN tidak sedang mencoba menyambung ulang, paksa ke login
  if (!window.isWaConnected && !window.isWaReconnecting) {
    console.warn('[Guard] Sesi tidak aktif, mengalihkan ke login...');
    return '/login';
  }

  return true;
});

// ── Status Sync ────────────────────────────────────────────────────────────
import { WaAPI } from './services/api.js';

async function syncStatus() {
  try {
    const status = await WaAPI.status();
    window.isWaConnected = status.connected;
    
    // Gunakan sessionUser jika sedang reconnecting agar UI tetap menampilkan info user
    window.waUser = status.user || status.sessionUser;
    
    // Jika di backend ada session tapi belum 'connected', berarti kemungkinan sedang reconnecting
    if (!status.connected && status.sessionUser) {
      window.isWaReconnecting = true;
    } else {
      window.isWaReconnecting = false;
    }

    // Jika tidak terkoneksi dan tidak sedang mencoba menyambung, paksa ke login
    if (!window.isWaConnected && !window.isWaReconnecting && window.location.hash !== '#/login') {
      Router.navigate('/login');
    }
    document.dispatchEvent(new CustomEvent('wa:status-updated', { detail: status }));
  } catch (err) {
    console.error('Gagal sinkronisasi status', err);
  }
}

// ── Tauri IPC listeners ────────────────────────────────────────────────────
IPC.onWaQR((payload) => {
  console.log('[IPC] QR Data diterima dari backend');
  window.lastQR = payload.qr;
  window.isWaConnected = false;
  window.isWaReconnecting = false;
  
  if (window.location.hash !== '#/login') {
    Router.navigate('/login');
  }

  setTimeout(() => {
    document.dispatchEvent(new CustomEvent('wa:qr', { detail: payload }));
  }, 100);
});

IPC.onWaReady((payload) => {
  window.isWaConnected = true;
  window.isWaReconnecting = false;
  window.waUser        = payload.user;
  document.dispatchEvent(new CustomEvent('wa:ready', { detail: payload }));
  
  // Hanya pindah ke dashboard jika saat ini sedang di halaman login
  if (window.location.hash === '#/login' || window.location.hash === '') {
    Router.navigate('/dashboard');
  }
});

IPC.onWaDisconnected((payload) => {
  console.log('[IPC] WhatsApp terputus:', payload);
  
  // Jika ini hanya putus sementara (reconnecting), jangan paksa ke login
  if (payload && payload.isTemporary) {
    window.isWaConnected = false;
    window.isWaReconnecting = true;
    document.dispatchEvent(new CustomEvent('wa:disconnected', { detail: payload }));
    return;
  }

  // Jika putus permanen (logout/session expired), baru pindah ke login
  window.isWaConnected = false;
  window.isWaReconnecting = false;
  document.dispatchEvent(new CustomEvent('wa:disconnected', { detail: payload }));
  Router.navigate('/login');
});

IPC.onBlastProgress((payload) => {
  document.dispatchEvent(new CustomEvent('blast:progress', { detail: payload }));
});

IPC.onBlastDone((payload) => {
  document.dispatchEvent(new CustomEvent('blast:done', { detail: payload }));
});

// ── Mulai aplikasi ─────────────────────────────────────────────────────────
(async () => {
  await syncStatus();
  // Sync status setiap 15 detik sebagai fallback
  setInterval(syncStatus, 15000);
  
  Sidebar.mount(document.getElementById('sidebar'));
  Router.init();
})();
