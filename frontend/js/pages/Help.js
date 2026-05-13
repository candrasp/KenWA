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
              <div class="faq-question">Bagaimana cara menghubungkan WhatsApp?</div>
              <div class="faq-answer">
                Buka menu <strong>Login WA</strong>, tunggu hingga QR Code muncul, lalu pindai (scan) menggunakan aplikasi WhatsApp di ponsel Anda melalui fitur "Linked Devices".
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">Bagaimana cara mengirim pesan massal (Blast)?</div>
              <div class="faq-answer">
                Pastikan Anda sudah mengimpor kontak di menu <strong>Kontak</strong>. Setelah itu, buka menu <strong>Blast Pesan</strong>, pilih kontak/tag, tulis pesan Anda, dan klik kirim.
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">Mengapa pesan saya gagal terkirim?</div>
              <div class="faq-answer">
                Kegagalan bisa disebabkan oleh koneksi internet yang tidak stabil, nomor tujuan tidak terdaftar di WhatsApp, atau sesi WhatsApp Anda telah terputus. Periksa status koneksi di Sidebar.
              </div>
            </div>
          </div>
        </div>

        <div class="help-sidebar">
          <div class="contact-card">
            <h3>Butuh Bantuan Lebih?</h3>
            <p>Tim dukungan kami siap membantu Anda setiap hari kerja pukul 09:00 - 17:00.</p>
            <div class="contact-methods">
              <a href="https://wa.me/628123456789" target="_blank" class="contact-link">
                <i class='bx bxl-whatsapp'></i> WhatsApp Support
              </a>
              <a href="mailto:support@kenwa.app" class="contact-link">
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

        .contact-card {
          background: linear-gradient(135deg, var(--clr-accent-dim), var(--success));
          color: white;
          padding: var(--space-6);
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-4);
          box-shadow: var(--shadow-md);
        }

        .contact-card h3 {
          margin-bottom: var(--space-3);
          font-size: var(--text-lg);
        }

        .contact-card p {
          font-size: var(--text-xs);
          opacity: 0.9;
          margin-bottom: var(--space-5);
          line-height: var(--leading-normal);
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
          background: rgba(255, 255, 255, 0.15);
          color: white;
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-md);
          text-decoration: none;
          font-weight: 600;
          font-size: var(--text-sm);
          transition: all var(--ease-fast);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .contact-link:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
          color: white;
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
