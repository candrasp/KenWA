/**
 * Toast component — notifikasi sementara.
 *
 * Cara pakai:
 *   import Toast from '../components/Toast.js';
 *   Toast.show('Pesan terkirim!', 'success');
 *   Toast.show('Gagal konek', 'error');
 */

const container = () => document.getElementById('toast-container');

let _id = 0;

const Toast = {
  show(message, type = 'info', duration = 3500) {
    const id   = ++_id;
    const el   = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.id        = `toast-${id}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<span>${message}</span>`;

    container().appendChild(el);

    // Trigger animation
    requestAnimationFrame(() => el.classList.add('toast--visible'));

    setTimeout(() => {
      el.classList.remove('toast--visible');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error'),
  warn:    (msg) => Toast.show(msg, 'warn'),
  info:    (msg) => Toast.show(msg, 'info'),
};

export default Toast;
