/**
 * Help page — Panduan penggunaan dan informasi bantuan.
 */

const Help = {
  async mount(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Pusat Bantuan</h1>
        <p class="text-muted">Temukan jawaban untuk pertanyaan Anda atau hubungi tim dukungan kami.</p>
      </div>

      <div class="help-grid">
        <div class="help-section help-card">
          <h2 class="section-title"><i class='bx bx-book-open'></i> Panduan Penggunaan</h2>
          <div class="faq-list">
            <div class="faq-item">
              <div class="faq-question">Bagaimana menambahkan kontak dan tags?</div>
              <div class="faq-answer">
                Anda dapat menambahkan kontak dan tags melalui tiga cara:
                <ul>
                  <li><strong>Secara manual:</strong> Tambahkan satu per satu melalui form di menu Kontak.</li>
                  <li><strong>Secara import:</strong> Unggah file Excel atau CSV berisi daftar kontak.</li>
                  <li><strong>Secara sync wa:</strong> Sinkronisasi kontak langsung dari akun WhatsApp yang terhubung.</li>
                </ul>
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">Mengapa harus verifikasi nomor terlebih dahulu?</div>
              <div class="faq-answer">
                Verifikasi memastikan nomor tujuan valid dan aktif di WhatsApp. Ini sangat penting untuk meminimalisir kegagalan pengiriman dan menjaga akun Anda tetap aman dari deteksi aktivitas mencurigakan.
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">Bagaimana cara mengirim pesan massal (Blast)?</div>
              <div class="faq-answer">
                Pastikan Anda sudah mengimpor kontak, lalu buka menu <strong>Blast Pesan</strong>. Berikut penjelasan fitur di form kirim blast:
                <ul>
                  <li><strong># , @ , @all</strong>: Gunakan untuk mencari dan memilih Tag (#), Kontak (@), atau memilih semua kontak (@all) sebagai penerima pesan.</li>
                  <li><strong>{{nama}}</strong>: Variabel pada pesan teks yang akan digantikan secara otomatis dengan nama masing-masing penerima saat pesan dikirim.</li>
                  <li><strong>Template</strong>: Fitur untuk menyimpan pesan format standar yang sering digunakan agar tidak perlu mengetik ulang saat akan mengirim blast.</li>
                </ul>
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">Apa fungsi delay dan random delay?</div>
              <div class="faq-answer">
                <ul>
                  <li><strong>Delay:</strong> Jeda waktu tunggu tetap antar pengiriman pesan.</li>
                  <li><strong>Random Delay:</strong> Jeda acak tambahan agar aktivitas pengiriman tidak terlihat kaku seperti robot/bot di mata sistem WhatsApp.</li>
                </ul>
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">Mengapa pesan saya gagal terkirim?</div>
              <div class="faq-answer">
                Kegagalan bisa disebabkan oleh koneksi internet yang tidak stabil, nomor tujuan tidak terdaftar di WhatsApp, atau sesi WhatsApp Anda telah terputus. Periksa status koneksi di Sidebar.

                <div class="alert alert-warning mt-3" style="background: rgba(255, 193, 7, 0.1); border-left: 4px solid #ffc107; padding: var(--space-3); font-size: var(--text-xs); color: var(--text-main);">
                  <i class='bx bx-error-circle'></i> <strong>Peringatan:</strong> Gunakan fitur Blast dengan bijak. Hindari mengirim pesan massal secara berlebihan ke nomor yang tidak menyimpan kontak Anda untuk mencegah risiko akun terblokir oleh WhatsApp.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="help-sidebar">
          <div class="contact-card">
            <h3>Butuh Bantuan Lebih?</h3>
            <p>Tim dukungan kami siap membantu Anda setiap hari kerja pukul 09:00 - 17:00.</p>
            <div class="contact-methods">
              <a href="https://wa.me/628123456789?text=Halo%2C%20saya%20butuh%20bantuan%20untuk%20aplikasi%20KenWA" target="_blank" rel="noopener noreferrer" class="contact-link">
                <i class='bx bxl-whatsapp'></i> WhatsApp Support
              </a>
              <a href="mailto:candrasinggih@gmail.com" class="contact-link">
                <i class='bx bx-envelope'></i> Email Support
              </a>
            </div>
          </div>

          <div class="version-card">
            <p><strong>KenWA App</strong></p>
            <p>Versi v1.1.0</p>
            <p>&copy; 2024 KenVano. All rights reserved.</p>
          </div>
        </div>
      </div>

      <style>
        .help-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: var(--space-6);
          margin-top: var(--space-6);
        }

        @media (max-width: 992px) {
          .help-grid {
            grid-template-columns: 1fr;
          }
        }

        .help-card {
          background: var(--bg-panel);
          padding: var(--space-6);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
        }

        .section-title {
          font-size: var(--text-lg);
          margin-bottom: var(--space-5);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-main);
        }

        .section-title i {
          color: var(--success);
        }

        .faq-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .faq-item {
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .faq-item:last-child {
          border-bottom: none;
        }

        .faq-question {
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: var(--space-2);
          font-size: var(--text-md);
        }

        .faq-answer {
          color: var(--text-muted);
          line-height: var(--leading-relaxed);
          font-size: var(--text-sm);
        }

        .faq-answer ul {
          margin-top: var(--space-2);
          padding-left: var(--space-4);
        }

        .faq-answer li {
          margin-bottom: var(--space-1);
        }

        .contact-card {
          background: var(--clr-accent-glow);
          padding: var(--space-6);
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-4);
          border-left: 4px solid var(--success);
        }

        .contact-card h3 {
          margin-bottom: var(--space-3);
          font-size: var(--text-lg);
          color: var(--text-main);
        }

        .contact-card p {
          font-size: var(--text-xs);
          opacity: 0.8;
          margin-bottom: var(--space-5);
          line-height: var(--leading-normal);
          color: var(--text-muted);
        }

        .contact-methods {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .contact-link {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          text-decoration: none;
          font-weight: 600;
          font-size: var(--text-sm);
          transition: all var(--ease-fast);
          border: 1px solid var(--border);
        }

        .contact-link:hover {
          background: rgba(76, 175, 130, 0.1);
          border-color: var(--success);
          transform: translateY(-2px);
          color: var(--success);
        }

        .version-card {
          padding: var(--space-5);
          text-align: center;
          color: var(--text-dim);
          font-size: var(--text-xs);
        }
      </style>
    `;
  },
};

export default Help;
