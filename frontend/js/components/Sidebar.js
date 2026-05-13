/**
 * Sidebar component — renders navigation links.
 */

import Router from '../router.js';

const NAV_ITEMS = [
  { icon: 'bx bx-grid-alt', label: 'Beranda', path: '/dashboard' },
  { icon: 'bx bxl-whatsapp', label: 'Login WA', path: '/login' },
  { icon: 'bx bx-user-voice', label: 'Kontak', path: '/contacts' },
  { icon: 'bx bx-paper-plane', label: 'Blast Pesan', path: '/blast' },
  { icon: 'bx bx-history', label: 'Riwayat', path: '/history' },
  { icon: 'bx bx-cog', label: 'Pengaturan', path: '/settings' },
  { icon: 'bx bx-help-circle', label: 'Bantuan', path: '/help' },
];

const Sidebar = {
  mount(el) {
    if (!el) return;

    const render = () => {
      const isConnected = window.isWaConnected;
      const isReconnecting = window.isWaReconnecting;
      const currentPath = window.location.hash.slice(1) || '/login';

      el.innerHTML = `
        <nav class="sidebar-nav">
          ${NAV_ITEMS.map(item => {
        const isActive = currentPath === item.path;
        const isLocked = !isConnected && !isReconnecting && item.path !== '/login';

        // Sembunyikan menu jika terkunci atau sembunyikan login jika sudah terhubung/reconnecting
        if (isLocked || ((isConnected || isReconnecting) && item.path === '/login')) return '';

        return `
              <a href="#${item.path}" class="nav-item ${isActive ? 'active' : ''}" data-path="${item.path}">
                <i class='${item.icon} nav-icon'></i>
                <span class="nav-label">${item.label}</span>
              </a>
            `;
      }).join('')}
        </nav>
        ${(isConnected || isReconnecting) ? `
        <div class="sidebar-footer">
          <div class="user-profile">
            <div class="user-avatar">
              <img src="${window.waUser?.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(window.waUser?.name || 'User')}&background=282828&color=4caf82&bold=true`}" alt="Avatar" />
            </div>
            <div class="user-info">
              <p class="user-name">${window.waUser?.name || window.waUser?.id?.split(':')[0] || 'WhatsApp User'}</p>
              <p class="status-indicator" style="color: ${isReconnecting ? 'var(--warning)' : 'var(--success)'}">
                ● ${isReconnecting ? 'Reconnecting...' : 'Connected'}
              </p>
            </div>
          </div>
          
          <button class="btn-logout" id="btn-logout" title="Keluar dari sistem">
            <i class='bx bx-log-out'></i> Logout
          </button>
        </div>
        ` : ` `}
      `;
    };

    render();

    // Event listener untuk tombol logout
    el.addEventListener('click', async (e) => {
      if (e.target.closest('#btn-logout')) {
        const Modal = (await import('../components/Modal.js')).default;

        Modal.confirm({
          title: 'Konfirmasi Logout',
          message: 'Apakah Anda yakin ingin keluar dan memutuskan koneksi WhatsApp?',
          confirmText: 'Ya, Keluar',
          onConfirm: async () => {
            try {
              const { WaAPI } = await import('../services/api.js');
              const Toast = (await import('../components/Toast.js')).default;
              await WaAPI.disconnect();
              Router.navigate('/login');
              Toast.success('Berhasil keluar');
            } catch (err) {
              console.error('Logout error:', err);
            }
          }
        });
      }
    });

    // Re-render saat status berubah
    document.addEventListener('wa:status-updated', render);
    document.addEventListener('wa:ready', render);
    document.addEventListener('wa:disconnected', render);
    window.addEventListener('hashchange', render);
  },
};

export default Sidebar;
