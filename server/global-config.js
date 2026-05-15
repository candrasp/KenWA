/**
 * Global Configuration for KenWA
 * Mengatur perilaku aplikasi berdasarkan environment (development/production).
 */

const isProduction = process.env.NODE_ENV === 'production';

// Baca versi dari package.json — di dalam caxa bundle bisa gagal, gunakan fallback
let appVersion = '1.1.2'; // ← update ini saat bump versi
try {
  const pkg = require('./package.json');
  if (pkg && pkg.version) appVersion = pkg.version;
} catch (_) { /* caxa bundle: package.json tidak tersedia, pakai hardcoded */ }

const config = {
  version: appVersion,
  // Pengaturan saat tahap pengembangan (Development)
  development: {
    right_click: true,
    inspect_element: true,
    update_enabled: true,
    debug_log: false // true untuk development untuk manapilkan log di terminal
  },

  // Pengaturan saat aplikasi sudah di-build (NSIS/Production)
  production: {
    right_click: true, // false untuk production
    inspect_element: true, // false untuk production
    update_enabled: true, // true untuk production
    debug_log: false // false untuk production
  }
};

const activeConfig = isProduction ? config.production : config.development;
module.exports = { ...activeConfig, version: config.version };
