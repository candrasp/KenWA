/**
 * KenWA — App Entry Point
 * Inisialisasi sidebar, router, dan Tauri event listeners.
 */

import Router    from './router.js';
import Sidebar   from './components/Sidebar.js';
import IPC       from './services/ipc.js';

// ── Global Image Error Handler (untuk mengatasi CSP pada Avatar) ───────────
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG' && e.target.classList.contains('avatar-img')) {
    const img = e.target;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = 'true';
    
    const name = window.waUser?.name || 'User';
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=282828&color=4caf82&bold=true`;
  }
}, true);

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
    
    // Simpan QR jika ada di status (hasil cache backend)
    if (status.qr && !status.connected) {
      window.lastQR = status.qr;
    }

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

    document.addEventListener('wa:needs-login', () => {
      console.warn('[WA] Session expired or needs re-login');
      window.waUser = null;
      window.lastQR = null; // Hapus cache QR di frontend
      Router.navigate('/login');
    });

    document.addEventListener('wa:error', (e) => {
      const Toast = import('./components/Toast.js').then(m => m.default.error(e.detail.message || 'Terjadi kesalahan pada WhatsApp.'));
    });

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
  window.lastQR        = null; // Clear QR cache setelah berhasil connect
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
import { AppConfig } from './services/api.js';

async function initSecurity(config) {
  // 1. Matikan klik kanan secara global jika dinonaktifkan
  document.addEventListener('contextmenu', (e) => {
    if (!config.right_click) {
      // Kecuali pada input/textarea
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (isInput) {
        // Tampilkan custom context menu (Copy/Paste saja)
        showCustomContextMenu(e);
      }
      e.preventDefault();
    }
  });

  // 2. Matikan Inspect Element (F12, Ctrl+Shift+I, dll)
  if (!config.inspect_element) {
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    });
  }

  // 3. Simpan config global agar bisa diakses modul lain
  window.appConfig = config;
}

function showCustomContextMenu(e) {
  let menu = document.getElementById('custom-ctx-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'custom-ctx-menu';
    menu.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 4px 0;
      min-width: 120px;
      box-shadow: var(--shadow-lg);
    `;
    document.body.appendChild(menu);
  }

  menu.innerHTML = `
    <div class="ctx-item" id="ctx-copy" style="padding: 8px 16px; cursor: pointer; color: var(--text-main); font-size: 13px;">Copy</div>
    <div class="ctx-item" id="ctx-paste" style="padding: 8px 16px; cursor: pointer; color: var(--text-main); font-size: 13px;">Paste</div>
  `;

  // Handle Context Menu Actions
  menu.onclick = (e) => {
    if (e.target.id === 'ctx-copy') document.execCommand('copy');
    if (e.target.id === 'ctx-paste') document.execCommand('paste');
    menu.style.display = 'none';
  };

  menu.style.left = `${e.pageX}px`;
  menu.style.top = `${e.pageY}px`;
  menu.style.display = 'block';

  // Hover effects
  const items = menu.querySelectorAll('.ctx-item');
  items.forEach(item => {
    item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.05)';
    item.onmouseleave = () => item.style.background = 'transparent';
  });

  const closeMenu = () => {
    menu.style.display = 'none';
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

async function checkAutoUpdate(config) {
  if (config.update_enabled === false) return;

  const tauri = window.__TAURI__;
  const updater = tauri?.updater || tauri?.plugins?.updater;
  if (!tauri || !updater) return;

  try {
    const update = await updater.check();
    if (update && update.available) {
      showForcedUpdateModal(update);
    }
  } catch (err) {
    console.error('[AutoUpdate] Gagal cek update:', err);
  }
}

function showForcedUpdateModal(update) {
  // Buat overlay modal yang tidak bisa ditutup
  const overlay = document.createElement('div');
  overlay.id = 'forced-update-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  `;

  overlay.innerHTML = `
    <div class="settings-card" style="max-width: 450px; width: 100%; border: 1px solid var(--warning);">
      <div class="settings-card-header" style="background: rgba(245, 158, 11, 0.1); border-bottom: 1px solid rgba(245, 158, 11, 0.2);">
        <i class='bx bx-error-circle' style="color: var(--warning);"></i>
        <h2 style="color: var(--warning);">Update Wajib Tersedia</h2>
      </div>
      <div class="settings-card-body" style="text-align: center;">
        <p style="margin-bottom: var(--space-4); color: var(--text-main);">
          Versi baru <b>v${update.version}</b> telah tersedia. 
        </p>
        <p style="font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-6); line-height: 1.6;">
          Pembaruan ini sangat penting untuk menjaga kompatibilitas dengan algoritma WhatsApp terbaru. Aplikasi tidak dapat digunakan hingga Anda melakukan pembaruan.
        </p>
        
        <div id="forced-update-progress" style="display: none; margin-bottom: var(--space-4);">
          <div class="update-progress-text">
            <span>Mengunduh pembaruan...</span>
            <span id="forced-percent">0%</span>
          </div>
          <div class="update-progress-bar">
            <div id="forced-fill" class="update-progress-fill" style="width: 0%;"></div>
          </div>
        </div>

        <button id="btn-forced-update" class="btn btn-primary" style="width: 100%; background: var(--warning); color: #000; font-weight: 700; padding: var(--space-4);">
          <i class='bx bx-cloud-download'></i> Update Sekarang
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const btn = document.getElementById('btn-forced-update');
  const progressContainer = document.getElementById('forced-update-progress');
  const progressFill = document.getElementById('forced-fill');
  const progressPercent = document.getElementById('forced-percent');

  btn.onclick = async () => {
    try {
      btn.disabled = true;
      btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Menyiapkan...";
      progressContainer.style.display = 'block';

      await update.downloadAndInstall((event) => {
        const tauri = window.__TAURI__;
        const process = tauri?.process || tauri?.plugins?.process;

        switch (event.event) {
          case 'Progress':
            const chunkLength = event.data.chunkLength;
            const contentLength = event.data.contentLength;
            if (contentLength) {
              const percent = Math.round((chunkLength / contentLength) * 100);
              progressFill.style.width = `${percent}%`;
              progressPercent.textContent = `${percent}%`;
              btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Mengunduh (${percent}%)`;
            }
            break;
          case 'Finished':
            btn.innerHTML = "<i class='bx bx-check'></i> Selesai! Me-restart...";
            if (process) {
              setTimeout(() => process.relaunch(), 1500);
            }
            break;
        }
      });
    } catch (err) {
      console.error('[ForcedUpdate] Error:', err);
      btn.disabled = false;
      btn.innerHTML = "<i class='bx bx-error'></i> Gagal, Coba Lagi";
    }
  };
}

// ── Helper: Update versi di footer ───────────────────────────────────────────
function setAppVersion(version) {
  if (!version) return;
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = `v${version}`;
    console.log(`[App] Versi diset: v${version}`);
  }
}

(async () => {
  // Load config pertama kali
  try {
    const config = await AppConfig.get();
    initSecurity(config);
    setAppVersion(config.version);

    // Jalankan cek update otomatis setelah 3 detik aplikasi dibuka
    setTimeout(() => checkAutoUpdate(config), 3000);
  } catch (err) {
    console.warn('[App] Gagal memuat config saat startup, akan retry saat server-ready:', err.message);
    
    // Fallback: Retry saat server-ready SSE event diterima (production: server mungkin belum siap)
    IPC.listen('server-ready', async () => {
      try {
        const config = await AppConfig.get();
        initSecurity(config);
        setAppVersion(config.version);
      } catch (e) {
        console.error('[App] Gagal memuat config setelah server-ready:', e.message);
      }
    });
  }

  await syncStatus();
  // Sync status setiap 15 detik sebagai fallback
  setInterval(syncStatus, 15000);
  
  Sidebar.mount(document.getElementById('sidebar'));
  Router.init();
})();
