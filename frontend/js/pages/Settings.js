/**
 * Settings page — Pengaturan blast, verifikasi, dan update software.
 */

import { SettingAPI } from '../services/api.js';
import IPC from '../services/ipc.js';
import Toast from '../components/Toast.js';

const Settings = {
  settings: null,
  updateInfo: {
    currentVersion: '1.0.0',
    newVersion: null,
    status: 'IDLE', // IDLE, CHECKING, AVAILABLE, UP_TO_DATE, DOWNLOADING, READY
    error: null
  },

  async mount(container) {
    this.render(container);
    await this.loadSettings();
    this.initEventListeners(container);
    this.checkAppVersion();
  },

  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Pengaturan</h1>
        <p class="text-muted">Kelola konfigurasi aplikasi dan perbarui software.</p>
      </div>

      <div class="settings-grid">
        <!-- Card 1: Pengaturan Blast -->
        <div class="settings-card">
          <div class="settings-card-header">
            <i class='bx bx-send'></i>
            <h2>Pengaturan Blast</h2>
          </div>
          <div class="settings-card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="blast_delay">Delay Dasar</label>
                <div class="input-with-unit">
                  <input type="number" id="blast_delay" class="form-input" placeholder="7000" min="6000" max="10000">
                  <span class="input-unit">ms</span>
                </div>
                <p class="error-msg" id="err-blast_delay"></p>
                <p class="helper-text">Delay minimal antar pesan (Min: 6s, Max: 10s).</p>
              </div>
              <div class="form-group">
                <label class="form-label" for="random_blast_delay">Delay Random</label>
                <div class="input-with-unit">
                  <input type="number" id="random_blast_delay" class="form-input" placeholder="2000" min="2000" max="5000">
                  <span class="input-unit">ms</span>
                </div>
                <p class="error-msg" id="err-random_blast_delay"></p>
                <p class="helper-text">Tambahan delay acak (Min: 2s, Max: 5s).</p>
              </div>
            </div>
          </div>
          <div class="settings-card-footer">
            <button class="btn btn-primary" id="save-blast-settings">
              <i class='bx bx-save'></i> Simpan
            </button>
          </div>
        </div>

        <!-- Card 2: Pengaturan Verifikasi -->
        <div class="settings-card">
          <div class="settings-card-header">
            <i class='bx bx-check-shield'></i>
            <h2>Verifikasi Nomor</h2>
          </div>
          <div class="settings-card-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="verification_delay">Delay Dasar</label>
                <div class="input-with-unit">
                  <input type="number" id="verification_delay" class="form-input" placeholder="5000" min="5000" max="9000">
                  <span class="input-unit">ms</span>
                </div>
                <p class="error-msg" id="err-verification_delay"></p>
                <p class="helper-text">Delay antar pengecekan nomor (Min: 5s, Max: 9s).</p>
              </div>
              <div class="form-group">
                <label class="form-label" for="random_verification_delay">Delay Random</label>
                <div class="input-with-unit">
                  <input type="number" id="random_verification_delay" class="form-input" placeholder="2000" min="2000" max="5000">
                  <span class="input-unit">ms</span>
                </div>
                <p class="error-msg" id="err-random_verification_delay"></p>
                <p class="helper-text">Tambahan delay acak (Min: 2s, Max: 5s).</p>
              </div>
            </div>
          </div>
          <div class="settings-card-footer">
            <button class="btn btn-primary" id="save-verification-settings">
              <i class='bx bx-save'></i> Simpan
            </button>
          </div>
        </div>

        <!-- Card 3: Cek Update Software -->
        <div class="settings-card" style="${window.appConfig?.update_enabled === false ? 'display: none;' : ''}">
          <div class="settings-card-header">
            <i class='bx bx-cloud-download'></i>
            <h2>Update Software</h2>
          </div>
          <div class="settings-card-body">
            <div class="update-info">
              <div class="software-info-item" style="justify-content: center; border-bottom: none; padding-top: 0;">
                <span class="info-value" style="font-size: 13px; color: var(--text-muted);">KenWA — WhatsApp Blaster</span>
              </div>
              <div class="software-info-item">
                <span class="info-label">Versi Saat Ini</span>
                <span class="info-value" id="current-version" style="font-size: 13px;">v1.0.0</span>
              </div>
              <div class="software-info-item">
                <span class="info-label">Status Update</span>
                <span id="update-status-badge" class="status-badge up-to-date">UP-TO-DATE</span>
              </div>

              <div id="new-version-info" style="display: none;">
                 <div class="software-info-item">
                    <span class="info-label">Versi Terbaru</span>
                    <span class="info-value" id="new-version-value" style="color: var(--warning);">v1.1.0</span>
                  </div>
              </div>

              <div id="checking-info" class="checking-status" style="display: none;">
                <i class='bx bx-loader-alt bx-spin'></i> Checking for updates...
              </div>

              <div id="update-progress-container" class="update-progress-container">
                <div class="update-progress-text">
                   <span>Downloading update...</span>
                   <span id="update-percent">0%</span>
                </div>
                <div class="update-progress-bar">
                   <div id="update-progress-fill" class="update-progress-fill"></div>
                </div>
              </div>

              <div class="update-actions">
                <button class="btn btn-secondary" id="btn-check-update">
                  <i class='bx bx-refresh' id="check-icon"></i> Cek Update
                </button>
                <button class="btn btn-success" id="btn-download-update" style="display: none;">
                  <i class='bx bx-download'></i> Download & Install
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async loadSettings() {
    try {
      this.settings = await SettingAPI.get();
      if (this.settings) {
        document.getElementById('blast_delay').value = this.settings.blast_delay;
        document.getElementById('random_blast_delay').value = this.settings.random_blast_delay;
        document.getElementById('verification_delay').value = this.settings.verification_delay;
        document.getElementById('random_verification_delay').value = this.settings.random_verification_delay;
      }
    } catch (err) {
      console.error('[Settings] Gagal memuat pengaturan:', err);
      Toast.error('Gagal memuat pengaturan. Pastikan WA terhubung.');
    }
  },

  initEventListeners(container) {
    const btnSaveBlast = document.getElementById('save-blast-settings');
    const btnSaveVerify = document.getElementById('save-verification-settings');
    const btnCheckUpdate = document.getElementById('btn-check-update');
    const btnDownloadUpdate = document.getElementById('btn-download-update');

    btnSaveBlast.onclick = () => this.saveSettings('blast');
    btnSaveVerify.onclick = () => this.saveSettings('verification');
    btnCheckUpdate.onclick = () => this.checkForUpdates();
    btnDownloadUpdate.onclick = () => this.downloadAndInstallUpdate();

    // Real-time validation
    const inputs = ['blast_delay', 'random_blast_delay', 'verification_delay', 'random_verification_delay'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.oninput = () => this.validateInput(id);
      }
    });
  },

  validateInput(id) {
    const el = document.getElementById(id);
    const errEl = document.getElementById(`err-${id}`);
    const min = parseInt(el.getAttribute('min'));
    const max = parseInt(el.getAttribute('max'));
    const val = parseInt(el.value);

    let error = '';
    if (isNaN(val)) {
      error = 'Nilai harus berupa angka.';
    } else if (val < min) {
      error = `Minimal ${min} ms.`;
    } else if (val > max) {
      error = `Maksimal ${max} ms.`;
    }

    if (error) {
      el.classList.add('invalid');
      errEl.textContent = error;
      errEl.style.display = 'block';
      return false;
    } else {
      el.classList.remove('invalid');
      errEl.style.display = 'none';
      return true;
    }
  },

  async saveSettings(type) {
    // Validate all before saving
    const inputs = type === 'blast' 
      ? ['blast_delay', 'random_blast_delay'] 
      : ['verification_delay', 'random_verification_delay'];
    
    let isValid = true;
    inputs.forEach(id => {
      if (!this.validateInput(id)) isValid = false;
    });

    if (!isValid) {
      Toast.error('Periksa kembali input Anda.');
      return;
    }

    try {
      const data = {
        blast_delay: parseInt(document.getElementById('blast_delay').value),
        random_blast_delay: parseInt(document.getElementById('random_blast_delay').value),
        verification_delay: parseInt(document.getElementById('verification_delay').value),
        random_verification_delay: parseInt(document.getElementById('random_verification_delay').value)
      };

      await SettingAPI.update(data);
      Toast.success('Pengaturan berhasil disimpan!');
    } catch (err) {
      console.error('[Settings] Gagal menyimpan:', err);
      Toast.error('Gagal menyimpan pengaturan.');
    }
  },

  async checkAppVersion() {
    // Coba ambil versi dari Tauri jika ada
    const tauri = window.__TAURI__;
    if (tauri) {
      try {
        const version = await tauri.app.getVersion();
        document.getElementById('current-version').textContent = `v${version}`;
        this.updateInfo.currentVersion = version;
      } catch (e) {
        console.warn('[Settings] Gagal ambil versi tauri', e);
      }
    }
  },

  async checkForUpdates() {
    const btn = document.getElementById('btn-check-update');
    const icon = document.getElementById('check-icon');
    const checkingInfo = document.getElementById('checking-info');
    const badge = document.getElementById('update-status-badge');
    const newVersionInfo = document.getElementById('new-version-info');
    const btnDownload = document.getElementById('btn-download-update');

    // UI: Loading state
    btn.disabled = true;
    icon.className = 'bx bx-loader-alt bx-spin';
    checkingInfo.style.display = 'flex';
    newVersionInfo.style.display = 'none';
    btnDownload.style.display = 'none';

    try {
      const tauri = window.__TAURI__;
      const updater = tauri?.updater || tauri?.plugins?.updater;
      
      if (!tauri || !updater) {
          // Simulasi jika tidak di tauri
          await new Promise(r => setTimeout(r, 2000));
          this.setUpdateStatus('UP_TO_DATE');
          Toast.success('Software Anda sudah versi terbaru.');
      } else {
          // Tauri v2 Updater Logic
          const update = await updater.check();
          
          if (update && update.available) {
              this.updateInfo.newVersion = update.version;
              this.setUpdateStatus('AVAILABLE', update.version);
              Toast.info('Pembaruan tersedia!');
          } else {
              this.setUpdateStatus('UP_TO_DATE');
          }
      }
    } catch (err) {
      console.error('[Settings] Gagal cek update:', err);
      Toast.error('Gagal memeriksa pembaruan.');
      this.setUpdateStatus('IDLE');
    } finally {
      btn.disabled = false;
      icon.className = 'bx bx-refresh';
      checkingInfo.style.display = 'none';
    }
  },

  setUpdateStatus(status, newVersion = null) {
    const badge = document.getElementById('update-status-badge');
    const newVersionInfo = document.getElementById('new-version-info');
    const newVersionValue = document.getElementById('new-version-value');
    const btnDownload = document.getElementById('btn-download-update');

    if (status === 'AVAILABLE') {
      badge.textContent = 'UPDATE AVAILABLE';
      badge.className = 'status-badge update-available';
      newVersionInfo.style.display = 'block';
      newVersionValue.textContent = `v${newVersion}`;
      btnDownload.style.display = 'inline-flex';
    } else if (status === 'UP_TO_DATE') {
      badge.textContent = 'UP-TO-DATE';
      badge.className = 'status-badge up-to-date';
      newVersionInfo.style.display = 'none';
      btnDownload.style.display = 'none';
    } else {
      badge.textContent = 'IDLE';
      badge.className = 'status-badge';
    }
  },

  async downloadAndInstallUpdate() {
    const tauri = window.__TAURI__;
    const updater = tauri?.updater || tauri?.plugins?.updater;

    if (!tauri || !updater) {
      Toast.warn('Fitur update hanya tersedia di aplikasi desktop.');
      return;
    }

    const progressContainer = document.getElementById('update-progress-container');
    const progressFill = document.getElementById('update-progress-fill');
    const progressPercent = document.getElementById('update-percent');
    const btnDownload = document.getElementById('btn-download-update');

    try {
      btnDownload.disabled = true;
      progressContainer.style.display = 'block';

      const update = await updater.check();
      if (update && update.available) {
        await update.downloadAndInstall((event) => {
          const process = tauri?.process || tauri?.plugins?.process;
          
          switch (event.event) {
            case 'Started':
              console.log('Download started');
              break;
            case 'Progress':
              const chunkLength = event.data.chunkLength;
              const contentLength = event.data.contentLength;
              if (contentLength) {
                const percent = Math.round((chunkLength / contentLength) * 100);
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
              }
              break;
            case 'Finished':
              Toast.success('Update selesai! Me-restart aplikasi...');
              if (process) {
                setTimeout(() => process.relaunch(), 2000);
              } else {
                Toast.info('Silakan restart aplikasi secara manual.');
              }
              break;
          }
        });
      }
    } catch (err) {
      console.error('[Settings] Gagal download update:', err);
      Toast.error('Gagal mengunduh pembaruan.');
      progressContainer.style.display = 'none';
      btnDownload.disabled = false;
    }
  }
};

export default Settings;
