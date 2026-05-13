/** Login / QR Scan page */

import { WaAPI } from '../services/api.js';
import Toast     from '../components/Toast.js';

const Login = {
  async mount(container) {
    container.innerHTML = `
      <div class="login-view">
        <div class="login-panel">
          <div class="login-header">
            <h1>Hubungkan WhatsApp</h1>
            <p>Silakan tautkan perangkat Anda untuk mulai mengirim pesan blast.</p>
          </div>
          
          <div class="login-content">
            <div class="qr-container" id="qr-wrapper">
              <div class="qr-placeholder" id="qr-placeholder">
                <div class="qr-spinner"></div>
                <p class="text-shine">Menunggu QR Code...</p>
              </div>
              <img id="qr-img" src="" alt="QR Code" style="display:none; width:100%; height:100%;" />
            </div>

            <div class="tutorial-steps">
              <div class="step-item">
                <div class="step-number">1</div>
                <div class="step-text">Buka <b>WhatsApp</b> di ponsel Anda</div>
              </div>
              <div class="step-item">
                <div class="step-number">2</div>
                <div class="step-text">Ketuk <b>Menu</b> atau <b>Setelan</b> dan pilih <b>Perangkat Tertaut</b></div>
              </div>
              <div class="step-item">
                <div class="step-number">3</div>
                <div class="step-text">Ketuk pada <b>Tautkan Perangkat</b></div>
              </div>
              <div class="step-item">
                <div class="step-number">4</div>
                <div class="step-text">Arahkan ponsel Anda ke layar ini untuk memindai kode QR</div>
              </div>
              <div class="step-item">
                <div class="step-number">5</div>
                <div class="step-text">Sistem akan otomatis masuk setelah pemindaian berhasil</div>
              </div>
              
              <div style="margin-top: var(--space-4);">
                <button class="btn btn-primary" id="btn-connect" style="width: 100%;">
                  <i class='bx bx-refresh'></i> Generate QR Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const btnConnect = document.getElementById('btn-connect');
    if (btnConnect) {
      btnConnect.onclick = async () => {
        try {
          await WaAPI.connect();
          Toast.info('Meminta QR Code baru...');
        } catch (err) {
          Toast.error(err.message);
        }
      };
    }

    // Fungsi update UI QR
    const renderQR = (qrDataUrl) => {
      const img = document.getElementById('qr-img');
      const placeholder = document.getElementById('qr-placeholder');
      if (img && placeholder) {
        placeholder.style.display = 'none';
        img.src = qrDataUrl;
        img.style.display = 'block';
      }
    };

    // Jika QR sudah ada di memory, langsung render
    if (window.lastQR) {
      renderQR(window.lastQR);
    }

    // Dengarkan event QR baru
    document.addEventListener('wa:qr', (e) => {
      renderQR(e.detail.qr);
    }, { once: false });
  },
};

export default Login;
