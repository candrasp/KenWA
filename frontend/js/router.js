/**
 * KenWA — SPA Router (Hash-based)
 *
 * Cara pakai:
 *   import router from './router.js';
 *   router.navigate('/dashboard');
 */

const routes = {
  '/login':     () => import('./pages/Login.js'),
  '/dashboard': () => import('./pages/Dashboard.js'),
  '/contacts':  () => import('./pages/Contacts.js'),
  '/blast':     () => import('./pages/Blast.js'),
  '/settings':  () => import('./pages/Settings.js'),
  '/history':   () => import('./pages/History.js'),
  '/help':      () => import('./pages/Help.js'),
};

const Router = {
  _beforeEach: null,

  /** Daftarkan route: Router.register('/path', () => import('./pages/Page.js')) */
  register(path, loader) {
    routes[path] = loader;
  },

  /** Daftarkan guard: Router.beforeEach((to) => { ... }) */
  beforeEach(fn) {
    this._beforeEach = fn;
  },

  /** Navigasi programatik */
  navigate(path) {
    window.location.hash = path;
  },

  /** Inisialisasi — pasang listener hash change */
  init() {
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve(); // handle initial load
  },

  async _resolve() {
    const hash = window.location.hash.slice(1) || '/dashboard';

    // ── Guard Check ────────────────────────────────────────────────────────
    if (this._beforeEach) {
      const result = await this._beforeEach(hash);
      if (result === false) return; // Batalkan navigasi
      if (typeof result === 'string' && result !== hash) {
        this.navigate(result); // Alihkan
        return;
      }
    }

    const loader = routes[hash] || routes['/404'];

    const container = document.getElementById('view-container');
    if (!loader) {
      container.innerHTML = '<p style="color:var(--clr-danger)">404 — Halaman tidak ditemukan</p>';
      return;
    }

    try {
      container.innerHTML = '<div class="page-loading">Memuat…</div>';
      const mod = await loader();
      await mod.default?.mount(container);
    } catch (err) {
      console.error('[Router]', err);
      container.innerHTML = `<p style="color:var(--clr-danger)">Error: ${err.message}</p>`;
    }
  },
};

export default Router;
