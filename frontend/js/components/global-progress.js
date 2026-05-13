/**
 * GlobalProgress component — Bar progress global untuk blast/verifikasi.
 * Tampil di bagian atas dashboard saat ada proses berjalan.
 */

const GlobalProgress = {
  el: null,
  
  init() {
    if (this.el) return;
    
    this.el = document.createElement('div');
    this.el.id = 'global-progress-container';
    this.el.className = 'global-progress-bar hidden';
    this.el.innerHTML = `
      <div class="progress-track">
        <div class="progress-fill" id="g-progress-fill"></div>
      </div>
      <div class="progress-info">
        <div class="progress-stats">
          <div class="stat-pill success" id="g-stat-pill-success">
            <i class='bx bx-check-circle'></i>
            <span id="g-stat-success">0</span><span id="g-label-success"> Terdaftar</span>
          </div>
          <div class="stat-pill danger" id="g-stat-pill-failed">
            <i class='bx bx-x-circle'></i>
            <span id="g-stat-failed">0</span><span id="g-label-failed"> Tidak Terdaftar</span>
          </div>
        </div>
        <div class="progress-counter">
          <span id="g-stat-current">0</span> / <span id="g-stat-total">0</span>
        </div>
      </div>
    `;
    
    // Injeksi ke body agar fixed position bekerja global tanpa terpotong overflow container
    document.body.appendChild(this.el);
  },

  show(total, mode = 'verify') {
    this.init();
    
    const labelSuccess = document.getElementById('g-label-success');
    const labelFailed = document.getElementById('g-label-failed');
    
    if (mode === 'blast') {
      if (labelSuccess) labelSuccess.innerText = ' Terkirim';
      if (labelFailed) labelFailed.innerText = ' Gagal';
    } else {
      if (labelSuccess) labelSuccess.innerText = ' Terdaftar';
      if (labelFailed) labelFailed.innerText = ' Tidak Terdaftar';
    }

    this.update(0, 0, 0, total);
    this.el.classList.remove('hidden');
    this.el.classList.add('visible');
  },

  hide() {
    if (!this.el) return;
    this.el.classList.remove('visible');
    setTimeout(() => this.el.classList.add('hidden'), 400);
  },

  update(current, success, failed, total) {
    this.init();
    const percent = total > 0 ? (current / total) * 100 : 0;
    
    const fill = document.getElementById('g-progress-fill');
    const sSucc = document.getElementById('g-stat-success');
    const sFail = document.getElementById('g-stat-failed');
    const sCurr = document.getElementById('g-stat-current');
    const sTotal = document.getElementById('g-stat-total');

    if (fill) fill.style.width = `${percent}%`;
    if (sSucc) sSucc.innerText = success;
    if (sFail) sFail.innerText = failed;
    if (sCurr) sCurr.innerText = current;
    if (sTotal) sTotal.innerText = total;
  }
};

export default GlobalProgress;
