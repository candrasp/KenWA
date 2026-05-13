/**
 * Modal component — dialog konfirmasi / form.
 *
 * Cara pakai:
 *   import Modal from '../components/Modal.js';
 *   Modal.open({ title: 'Hapus?', body: '<p>Yakin hapus?</p>', onConfirm: () => {} });
 */

const Modal = {
  open({ title = '', body = '', onConfirm, onCancel, confirmText = 'Ya', cancelText = 'Batal', size = '' } = {}) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal ${size ? 'modal-' + size : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-header">
            <h2 class="modal-title" id="modal-title">${title}</h2>
            <button class="action-btn" id="modal-close-icon"><i class='bx bx-x'></i></button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
            <button class="btn btn-primary" id="modal-confirm">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => container.querySelector('.modal-overlay').classList.add('visible'));

    document.getElementById('modal-confirm').onclick = () => {
      onConfirm?.();
      Modal.close();
    };
    document.getElementById('modal-cancel').onclick = () => {
      onCancel?.();
      Modal.close();
    };
    document.getElementById('modal-close-icon').onclick = () => {
      onCancel?.();
      Modal.close();
    };
    document.getElementById('modal-overlay').onclick = (e) => {
      if (e.target.id === 'modal-overlay') Modal.close();
    };
  },

  confirm({ title, message, onConfirm, onCancel, confirmText = 'Ya', cancelText = 'Batal' }) {
    this.open({
      title,
      body: `<p class="text-muted">${message}</p>`,
      onConfirm,
      onCancel,
      confirmText,
      cancelText
    });
  },

  close() {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  },
};

export default Modal;
