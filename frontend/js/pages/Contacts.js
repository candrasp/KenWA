import { ContactAPI, TagAPI, SettingAPI, ActivityAPI } from '../services/api.js';
import Table from '../components/Table.js';
import Modal from '../components/Modal.js';
import Toast from '../components/Toast.js';
import GlobalProgress from '../components/global-progress.js';

const Contacts = {
  el: null,
  isVerifying: false,

  updateButtonStates() {
    const btnSync = document.getElementById('btn-sync-contact');
    const btnImport = document.getElementById('btn-import-contact');
    const btnAdd = document.getElementById('btn-add-contact');
    const btnVerify = document.getElementById('btn-verify-contacts');

    const isConnected = window.isWaConnected || false;
    const isReconnecting = window.isWaReconnecting || false;
    const isVerifying = window.isVerifying || false;

    // 1. Jika tidak konek / Reconnecting / Verifying -> Sync WA disable
    if (btnSync) {
      const shouldDisable = !isConnected || isReconnecting || isVerifying;
      btnSync.disabled = shouldDisable;
      btnSync.style.opacity = shouldDisable ? '0.5' : '1';
      btnSync.style.cursor = shouldDisable ? 'not-allowed' : 'pointer';
    }

    // 2. Jika Verifikasi berjalan -> Sync, Import, Tambah disable
    if (btnImport) {
      btnImport.disabled = isVerifying;
      btnImport.style.opacity = isVerifying ? '0.5' : '1';
      btnImport.style.cursor = isVerifying ? 'not-allowed' : 'pointer';
    }
    if (btnAdd) {
      btnAdd.disabled = isVerifying;
      btnAdd.style.opacity = isVerifying ? '0.5' : '1';
      btnAdd.style.cursor = isVerifying ? 'not-allowed' : 'pointer';
    }

    // 3. Tombol Verifikasi -> Spinner & Disable
    if (btnVerify) {
      if (isVerifying) {
        btnVerify.disabled = true;
        btnVerify.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Memverifikasi...`;
        btnVerify.style.opacity = '0.7';
        btnVerify.style.cursor = 'not-allowed';
      } else {
        // Cek jika ada yang perlu diverifikasi (logika awal)
        // Kita tidak ingin mereset innerHTML jika tidak sedang memverifikasi karena ada icon aslinya
        btnVerify.disabled = false;
        btnVerify.innerHTML = `<i class='bx bx-check-shield'></i> Verifikasi Nomor`;
        btnVerify.style.opacity = '1';
        btnVerify.style.cursor = 'pointer';
      }
    }
  },

  async refreshVerifyButtonVisibility() {
    try {
      const statusRes = await ContactAPI.list({ limit: 1 });
      const btnVerify = document.getElementById('btn-verify-contacts');
      console.log('[Contacts] unverifiedCount:', statusRes?.unverifiedCount);
      if (btnVerify) {
        const count = statusRes?.unverifiedCount;
        const hasUnverified = count !== undefined
          ? Number(count) > 0
          : (statusRes?.rows || []).some(c => !c.verification_status || parseInt(c.verification_status) === 0);
        btnVerify.style.display = hasUnverified ? 'inline-flex' : 'none';
      }
    } catch (err) {
      console.error('[Contacts] Gagal refresh verify button:', err);
    }
  },

  activeTab: 'contacts', // 'contacts' or 'tags'

  async mount(container) {
    this.container = container;
    this.renderBase();
    this.initTabs();
    this.switchTab(this.activeTab);
  },

  renderBase() {
    this.container.innerHTML = `

    <div class="page-header">
        <h1 class="page-title">Daftar Kontak & Tags</h1>
      </div>
      <div class="tabs-header">
        <button class="tab-link" data-tab="contacts">Daftar Kontak</button>
        <button class="tab-link" data-tab="tags">Daftar Tags</button>
      </div>

      <div id="tab-content-container">
        <!-- Content rendered here -->
      </div>
    `;
  },

  initTabs() {
    const links = this.container.querySelectorAll('.tab-link');
    links.forEach(link => {
      link.onclick = () => {
        const tab = link.dataset.tab;
        this.switchTab(tab);
      };
    });
  },

  switchTab(tab) {
    this.activeTab = tab;

    // Update UI active state
    const links = this.container.querySelectorAll('.tab-link');
    links.forEach(link => {
      link.classList.toggle('active', link.dataset.tab === tab);
    });

    // Render content
    const content = this.container.querySelector('#tab-content-container');
    content.innerHTML = '<div class="tab-content active"></div>';
    const tabEl = content.querySelector('.tab-content');

    if (tab === 'contacts') {
      this.renderContactsTab(tabEl);
    } else {
      this.renderTagsTab(tabEl);
    }
  },

  // ── Tab: Kontak ────────────────────────────────────────────────────────────

  async renderContactsTab(container) {
    container.innerHTML = `
      <div id="contacts-table" class="table-danger-select"></div>
    `;

    const tableEl = container.querySelector('#contacts-table');
    let selectedContactIds = [];

    // Gunakan AbortController agar listener otomatis dibersihkan saat tab berganti
    const abortCtrl = new AbortController();
    const { signal } = abortCtrl;

    // Bersihkan listener lama jika tab diganti sebelum selesai
    const cleanup = () => abortCtrl.abort();
    container.addEventListener('unmount', cleanup, { once: true });

    document.addEventListener('table:selectionChange', (e) => {
      selectedContactIds = e.detail;
      const btnBulk = document.getElementById('btn-bulk-delete');
      const countSpan = document.getElementById('bulk-delete-count');
      const btnBulkTags = document.getElementById('btn-bulk-tags');
      const tagsCountSpan = document.getElementById('bulk-tags-count');

      const hasSelection = selectedContactIds.length > 0;
      if (btnBulk && countSpan) {
        btnBulk.style.display = hasSelection ? 'inline-flex' : 'none';
        countSpan.textContent = selectedContactIds.length;
      }
      if (btnBulkTags && tagsCountSpan) {
        btnBulkTags.style.display = hasSelection ? 'inline-flex' : 'none';
        tagsCountSpan.textContent = selectedContactIds.length;
      }
    }, { signal });


    await Table.create({
      el: tableEl,
      columns: [
        { label: 'Nama', key: 'name', sortable: true, render: (v) => `<strong>${v || 'Tanpa Nama'}</strong>` },
        { label: 'Nomor', key: 'phone', sortable: true, render: (v) => `<code style="color: var(--text-main); opacity: 0.9;">${v}</code>` },
        {
          label: 'Tags',
          key: 'tags',
          render: (v) => {
            if (!v || v.length === 0) return '<span class="text-muted">—</span>';
            const tags = v.split(',');
            const displayTags = tags.slice(0, 3);
            const remaining = tags.length - 3;

            let html = displayTags.map(tag => `<span class="badge badge-info" style="margin-right: 4px;">${tag}</span>`).join('');
            if (remaining > 0) {
              html += `<span class="badge badge-secondary" style="font-size: 10px;">+${remaining}</span>`;
            }
            return html;
          }
        },
        {
          label: 'Status',
          key: 'verification_status',
          sortable: true,
          render: (v) => {
            const status = parseInt(v) || 0;
            let label = 'Belum Verifikasi';
            let color = 'var(--text-muted)';
            let bg = 'rgba(255,255,255,0.05)';

            if (status === 1) {
              label = 'Terdaftar';
              color = 'var(--success)';
              bg = 'rgba(76, 175, 130, 0.1)';
            } else if (status === 2) {
              label = 'Tidak Terdaftar';
              color = 'var(--danger)';
              bg = 'rgba(224, 92, 92, 0.1)';
            }

            return `
              <span class="badge" style="background: ${bg}; color: ${color}; border: 1px solid ${color};">
                ${label}
              </span>
            `;
          }
        },
        {
          label: 'Action',
          key: 'id',
          render: (id) => `
            <div class="flex gap-2">
              <button class="action-btn edit" title="Edit" onclick="window.handleEditContact('${id}')">
                <i class='bx bx-edit-alt'></i>
              </button>
              <button class="action-btn delete" title="Hapus" onclick="window.handleDeleteContact('${id}')">
                <i class='bx bx-trash'></i>
              </button>
            </div>
          `
        }
      ],
      fetchData: async (params) => {
        const res = await ContactAPI.list(params);
        return res;
      },
      options: {
        selectable: true,
        itemsPerPage: 20,
        customActions: `
          <button class="btn btn-danger" id="btn-bulk-delete" style="display: none;">
            <i class='bx bx-trash'></i> Hapus (<span id="bulk-delete-count">0</span>)
          </button>
          <button class="btn btn-info" id="btn-bulk-tags" style="display: none;">
            <i class='bx bx-tag'></i> Tambah Tag (<span id="bulk-tags-count">0</span>)
          </button>
          <button class="btn btn-warning" id="btn-verify-contacts" style="display: none;">
            <i class='bx bx-check-shield'></i> Verifikasi Nomor
          </button>
          <button class="btn btn-primary" id="btn-add-contact">
            <i class='bx bx-plus'></i> Kontak
          </button>
          <button class="btn btn-secondary" id="btn-import-contact">
            <i class='bx bx-import'></i> Import
          </button>
          <button class="btn btn-outline-success" id="btn-sync-contact">
            <i class='bx bx-sync'></i> Sync WA
          </button>
        `
      }
    });

    // Cek setelah tabel selesai dirender: tombol sudah ada di DOM.
    // Tampilkan tombol verifikasi jika ada nomor belum terverifikasi di database.
    try {
      const statusRes = await ContactAPI.list({ limit: 1 });
      const btnVerify = document.getElementById('btn-verify-contacts');
      console.log('[Contacts] unverifiedCount:', statusRes?.unverifiedCount);
      if (btnVerify) {
        // Fallback: jika backend belum return unverifiedCount, cek dari data halaman pertama
        const count = statusRes?.unverifiedCount;
        const hasUnverified = count !== undefined
          ? Number(count) > 0
          : (statusRes?.rows || []).some(c => !c.verification_status || parseInt(c.verification_status) === 0);
        btnVerify.style.display = hasUnverified ? 'inline-flex' : 'none';
      }
    } catch (err) {
      console.error('[Contacts] Gagal cek unverified count:', err);
    }

    // Update status tombol berdasarkan state saat ini
    this.updateButtonStates();
    this.refreshVerifyButtonVisibility();

    // Dengarkan update status WA untuk disable/enable tombol Sync
    const updateHandler = () => this.updateButtonStates();
    document.addEventListener('wa:status-updated', updateHandler, { signal });
    document.addEventListener('wa:ready', updateHandler, { signal });
    document.addEventListener('wa:disconnected', updateHandler, { signal });


    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.id === 'btn-verify-contacts') this.handleVerifyContacts();
      if (btn.id === 'btn-add-contact') this.openAddContactModal();
      if (btn.id === 'btn-import-contact') this.openImportModal();
      if (btn.id === 'btn-sync-contact') this.handleSyncWhatsApp();
      if (btn.id === 'btn-bulk-delete') this.handleBulkDelete(selectedContactIds);
      if (btn.id === 'btn-bulk-tags') this.handleBulkAddTags(selectedContactIds);
    });


    window.handleEditContact = (id) => this.openEditContactModal(id);
    window.handleDeleteContact = (id) => {
      Modal.open({
        title: 'Hapus Kontak?',
        body: '<p>Kontak yang dihapus tidak dapat dikembalikan.</p>',
        confirmText: 'Hapus',
        onConfirm: async () => {
          try {
            await ContactAPI.delete(id);
            Toast.success('Kontak berhasil dihapus');
            document.dispatchEvent(new CustomEvent('table:reload'));
          } catch (e) {
            Toast.error('Gagal menghapus kontak');
          }
        }
      });
    };
  },

  // ── Tab: Tags ──────────────────────────────────────────────────────────────

  async renderTagsTab(container) {
    container.innerHTML = `
      <div id="tags-table" class="table-danger-select"></div>
    `;

    const tableEl = container.querySelector('#tags-table');
    let selectedTagIds = [];

    // AbortController for cleanup
    const abortCtrl = new AbortController();
    const { signal } = abortCtrl;
    const cleanup = () => abortCtrl.abort();
    container.addEventListener('unmount', cleanup, { once: true });

    document.addEventListener('table:selectionChange', (e) => {
      // Pastikan kita hanya memproses jika di tab tags
      if (this.activeTab !== 'tags') return;

      selectedTagIds = e.detail;
      const btnBulk = document.getElementById('btn-bulk-delete-tags');
      const countSpan = document.getElementById('bulk-delete-tags-count');
      if (btnBulk && countSpan) {
        if (selectedTagIds.length > 0) {
          btnBulk.style.display = 'inline-flex';
          countSpan.textContent = selectedTagIds.length;
        } else {
          btnBulk.style.display = 'none';
        }
      }
    }, { signal });

    await Table.create({
      el: container.querySelector('#tags-table'),
      columns: [
        { label: 'Nama Tags', key: 'name', sortable: true, render: (v) => `<strong>${v}</strong>` },
        { label: 'Jumlah Kontak', key: 'contact_count', sortable: true, render: (v) => `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-main);">${v || 0}</span>` },
        {
          label: 'Action',
          key: 'id',
          render: (id) => `
            <div class="flex gap-2">
              <button class="action-btn edit" title="Edit" onclick="window.handleEditTag('${id}')">
                <i class='bx bx-edit-alt'></i>
              </button>
              <button class="action-btn delete" title="Hapus" onclick="window.handleDeleteTag('${id}')">
                <i class='bx bx-trash'></i>
              </button>
            </div>
          `
        }
      ],
      fetchData: async (params) => {
        const res = await TagAPI.list(params);
        return res;
      },
      options: {
        selectable: true,
        itemsPerPage: 20,
        customActions: `
          <button class="btn btn-danger" id="btn-bulk-delete-tags" style="display: none;">
            <i class='bx bx-trash'></i> Hapus Terpilih (<span id="bulk-delete-tags-count">0</span>)
          </button>
          <button class="btn btn-primary" id="btn-add-tag">
            <i class='bx bx-plus'></i> Tambah Tags
          </button>
        `
      }
    });

    tableEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'btn-add-tag') this.openAddTagModal();
      if (btn.id === 'btn-bulk-delete-tags') this.handleBulkDeleteTags(selectedTagIds);
    });

    window.handleEditTag = (id) => this.openEditTagModal(id);
    window.handleDeleteTag = (id) => {
      Modal.open({
        title: 'Hapus Tag?',
        body: '<p>Tag akan dihapus, namun kontak tetap ada.</p>',
        confirmText: 'Hapus',
        onConfirm: async () => {
          try {
            await TagAPI.delete(id);
            Toast.success('Tag berhasil dihapus');
            document.dispatchEvent(new CustomEvent('table:reload'));
          } catch (e) {
            Toast.error('Gagal menghapus tag');
          }
        }
      });
    };
  },

  // ── Modals ─────────────────────────────────────────────────────────────────

  async openAddContactModal() {
    let tags = [];
    try {
      const res = await TagAPI.list({ limit: 100 });
      tags = res.rows || (Array.isArray(res) ? res : []);
    } catch (e) {
      console.warn('Gagal memuat tags:', e);
      // Fallback mock jika API belum siap sepenuhnya
      tags = [
        { name: 'Pelanggan' },
        { name: 'Reseller' },
        { name: 'VVIP' },
        { name: 'Promo' }
      ];
    }

    const selectedTags = new Set();

    Modal.open({
      title: 'Tambah Kontak Baru',
      body: `
        <form id="form-add-contact">
          <div class="form-group">
            <label class="form-label">Nama Lengkap</label>
            <input type="text" name="name" class="form-input" placeholder="Contoh: John Doe" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor WhatsApp</label>
            <input type="text" name="number" id="input-contact-phone" class="form-input" placeholder="628123xxx" required>
            <small id="phone-error-msg" style="color: var(--danger); display: none; font-size: 11px; margin-top: 4px;"></small>
            <small class="helper-text">Gunakan format internasional (e.g. 62812...)</small>
          </div>
          <div class="form-group">
            <label class="form-label">Pilih Tags (Opsional)</label>
            <div class="tag-selector">
              ${tags.length > 0 ? tags.map(tag => `
                <div class="tag-badge-item inactive" data-tag="${tag.name}">${tag.name}</div>
              `).join('') : '<p class="text-muted" style="font-size: 12px;">Belum ada tags tersedia.</p>'}
            </div>
          </div>
        </form>
      `,
      confirmText: 'Simpan Kontak',
      onConfirm: async () => {
        const form = document.getElementById('form-add-contact');
        const formData = new FormData(form);
        const data = {
          name: formData.get('name'),
          phone: formData.get('number'),
          tags: Array.from(selectedTags).join(','),
        };

        try {
          await ContactAPI.create(data);
          ActivityAPI.create({ type: 'contact', message: `Menambahkan kontak baru: ${data.name}` }).catch(console.error);
          Toast.success('Kontak berhasil disimpan');
          document.dispatchEvent(new CustomEvent('table:reload'));

          // Auto Verify
          await this.refreshVerifyButtonVisibility();
          this.handleVerifyContacts(true);
        } catch (e) {
          Toast.error('Gagal menyimpan kontak: ' + e.message);
        }
      }
    });

    // logic cek nomor SSR
    const phoneInput = document.getElementById('input-contact-phone');
    const errorMsg = document.getElementById('phone-error-msg');
    let checkTimeout;

    phoneInput.oninput = (e) => {
      let val = e.target.value.trim();
      // Normalisasi: hanya angka
      val = val.replace(/[^0-9]/g, '');

      clearTimeout(checkTimeout);
      errorMsg.style.display = 'none';

      if (val.length < 5) return;

      checkTimeout = setTimeout(async () => {
        try {
          console.log('[SSR Check] Checking phone:', val);
          const res = await ContactAPI.checkExistence(val);
          if (res.exists) {
            errorMsg.innerText = 'Nomor sudah terdaftar di database';
            errorMsg.style.display = 'block';
          }
        } catch (err) {
          console.error('Check phone failed:', err);
        }
      }, 500);
    };

    // Pasang listener klik untuk setiap badge tag
    document.querySelectorAll('.tag-badge-item').forEach(el => {
      el.onclick = () => {
        const tag = el.dataset.tag;
        if (selectedTags.has(tag)) {
          selectedTags.delete(tag);
          el.classList.remove('active');
          el.classList.add('inactive');
        } else {
          selectedTags.add(tag);
          el.classList.add('active');
          el.classList.remove('inactive');
        }
      };
    });
  },

  openAddTagModal() {
    Modal.open({
      title: 'Tambah Tag Baru',
      body: `
        <form id="form-add-tag">
          <div class="form-group">
            <label class="form-label">Nama Tag</label>
            <input type="text" name="name" class="form-input" placeholder="Contoh: Reseller" required>
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi (Opsional)</label>
            <textarea name="description" class="form-input" style="height: 80px;" placeholder="Penjelasan singkat tentang tag ini..."></textarea>
          </div>
        </form>
      `,
      confirmText: 'Simpan Tag',
      onConfirm: async () => {
        const form = document.getElementById('form-add-tag');
        const formData = new FormData(form);
        const data = {
          name: formData.get('name'),
          description: formData.get('description'),
        };

        try {
          await TagAPI.create(data);
          Toast.success('Tag berhasil disimpan');
          document.dispatchEvent(new CustomEvent('table:reload'));
        } catch (e) {
          Toast.error('Gagal menyimpan tag: ' + e.message);
        }
      }
    });
  },
  async openEditContactModal(id) {
    try {
      const contact = await ContactAPI.get(id);
      const resTags = await TagAPI.list({ limit: 100 });
      const allTags = resTags.rows || (Array.isArray(resTags) ? resTags : []);
      const currentTags = contact.tags ? contact.tags.split(',') : [];
      const selectedTags = new Set(currentTags);

      Modal.open({
        title: 'Edit Kontak',
        body: `
          <form id="form-edit-contact">
            <div class="form-group">
              <label class="form-label">Nama Lengkap</label>
              <input type="text" name="name" class="form-input" value="${contact.name || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nomor WhatsApp</label>
              <input type="text" name="phone" class="form-input" value="${contact.phone || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Pilih Tags</label>
              <div class="tag-selector">
                ${allTags.length > 0 ? allTags.map(tag => `
                  <div class="tag-badge-item ${selectedTags.has(tag.name) ? 'active' : 'inactive'}" data-tag="${tag.name}">
                    ${tag.name}
                  </div>
                `).join('') : '<p class="text-muted" style="font-size: 12px;">Belum ada tags tersedia.</p>'}
              </div>
            </div>
          </form>
        `,
        confirmText: 'Update Kontak',
        onConfirm: async () => {
          const form = document.getElementById('form-edit-contact');
          const formData = new FormData(form);
          const data = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            tags: Array.from(selectedTags).join(','),
          };

          try {
            await ContactAPI.update(id, data);
            Toast.success('Kontak berhasil diperbarui');
            document.dispatchEvent(new CustomEvent('table:reload'));
          } catch (e) {
            Toast.error('Gagal memperbarui kontak');
          }
        }
      });

      document.querySelectorAll('.tag-badge-item').forEach(el => {
        el.onclick = () => {
          const tag = el.dataset.tag;
          if (selectedTags.has(tag)) {
            selectedTags.delete(tag);
            el.classList.remove('active');
            el.classList.add('inactive');
          } else {
            selectedTags.add(tag);
            el.classList.add('active');
            el.classList.remove('inactive');
          }
        };
      });
    } catch (e) {
      Toast.error('Gagal memuat data kontak');
    }
  },

  async openEditTagModal(id) {
    try {
      const tag = await TagAPI.get(id);
      if (!tag) throw new Error('Tag tidak ditemukan');

      Modal.open({
        title: 'Edit Tag',
        body: `
          <form id="form-edit-tag">
            <div class="form-group">
              <label class="form-label">Nama Tag</label>
              <input type="text" name="name" class="form-input" value="${tag.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Deskripsi</label>
              <textarea name="description" class="form-input" style="height: 80px;">${tag.description || ''}</textarea>
            </div>
          </form>
        `,
        confirmText: 'Update Tag',
        onConfirm: async () => {
          const form = document.getElementById('form-edit-tag');
          const formData = new FormData(form);
          const data = {
            name: formData.get('name'),
            description: formData.get('description'),
          };

          try {
            await TagAPI.update(id, data);
            Toast.success('Tag berhasil diperbarui');
            document.dispatchEvent(new CustomEvent('table:reload'));
          } catch (e) {
            Toast.error('Gagal memperbarui tag');
          }
        }
      });
    } catch (e) {
      Toast.error('Gagal memuat data tag');
    }
  },

  openImportModal() {
    Modal.open({
      title: 'Import Kontak',
      body: `
        <div class="text-center">
          <p class="text-muted mb-4">Unggah file CSV berisi daftar kontak Anda untuk di-import ke sistem.</p>
          
          <div class="file-upload-wrapper" id="upload-zone">
            <i class='bx bx-cloud-upload'></i>
            <span class="upload-text" id="file-name-label">Klik atau seret file ke sini</span>
            <span class="upload-hint">Dukung format .csv (Nama, Nomor)</span>
            <input type="file" id="import-file" accept=".csv">
          </div>

          <div class="mt-6 text-left" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4);">
            <div class="flex items-center gap-2 mb-2" style="color: var(--warning);">
              <i class='bx bx-info-circle'></i>
              <strong style="font-size: var(--text-xs); color: var(--text-main);">Tips Format CSV:</strong>
            </div>
            <p class="text-muted mb-2" style="font-size: 11px;">Pastikan file CSV Anda memiliki urutan kolom sebagai berikut:</p>
            <div style="background: var(--bg-dark); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
              <code style="font-size: 12px; color: var(--success); font-family: var(--font-mono);">Nama, Nomor</code>
              <div class="mt-1" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
                <code style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">John Doe, 628123456789</code>
              </div>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Mulai Import',
      onConfirm: async () => {
        const fileInput = document.getElementById('import-file');
        if (!fileInput.files.length) {
          Toast.error('Pilih file terlebih dahulu');
          return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
          const text = e.target.result;
          const lines = text.split('\n').filter(l => l.trim());
          let success = 0;
          let failed = 0;

          Toast.info(`Memproses ${lines.length} baris...`);

          for (const line of lines) {
            const [name, phone] = line.split(',').map(s => s.trim());
            if (!name || !phone) {
              failed++;
              continue;
            }

            try {
              await ContactAPI.create({ name, phone: phone.replace(/[^0-9]/g, '') });
              success++;
            } catch (err) {
              failed++;
            }
          }

          Toast.success(`Import selesai: ${success} berhasil, ${failed} gagal.`);
          if (success > 0) {
             ActivityAPI.create({ type: 'import', message: `Menambahkan ${success} kontak dari import CSV` }).catch(console.error);
          }
          document.dispatchEvent(new CustomEvent('table:reload'));

          // Auto Verify
          await this.refreshVerifyButtonVisibility();
          this.handleVerifyContacts(true);

        };

        reader.readAsText(file);
      }
    });

    // Handle file selection UI
    const fileInput = document.getElementById('import-file');
    const label = document.getElementById('file-name-label');
    const zone = document.getElementById('upload-zone');

    fileInput.onchange = () => {
      if (fileInput.files.length > 0) {
        const name = fileInput.files[0].name;
        label.innerText = name;
        zone.classList.add('has-file');
        Toast.success('File terpilih: ' + name);
      } else {
        label.innerText = 'Klik atau seret file ke sini';
        zone.classList.remove('has-file');
      }
    };
  },

  async handleSyncWhatsApp() {
    Toast.info('Memulai sinkronisasi kontak WhatsApp...');
    try {
      const res = await ContactAPI.syncContacts();
      if (res.success) {
        if (res.count > 0) {
          Toast.success(`Sinkronisasi berhasil! ${res.count} kontak baru ditambahkan.`);
          document.dispatchEvent(new CustomEvent('table:reload'));

          // Auto Verify
          await this.refreshVerifyButtonVisibility();
          this.handleVerifyContacts(true);
        } else {
          Toast.info('Sinkronisasi selesai. Tidak ada kontak baru yang ditemukan.');
        }
      }
    } catch (e) {
      console.error('Sync failed:', e);
      Toast.error('Gagal sinkronisasi kontak: ' + e.message);
    }
  },

  async handleVerifyContacts(skipConfirm = false) {
    const startVerification = async () => {
      console.log('[Contacts] Starting verification process...');
      window.isVerifying = true;
      document.dispatchEvent(new CustomEvent('verifying:status-updated', { detail: { isVerifying: true } }));
      this.updateButtonStates();

      try {
        // Ambil pengaturan delay
        const settings = await SettingAPI.get();
        const delay = settings.verification_delay || 5000;
        const random = settings.random_verification_delay || 2000;

        const res = await ContactAPI.list({ limit: 1000 });
        const list = res.rows || (Array.isArray(res) ? res : []);
        const contactsToVerify = list.filter(c => !c.verification_status || parseInt(c.verification_status) === 0);

        if (contactsToVerify.length === 0) {
          // Hanya tampilkan toast jika bukan auto-start
          if (!skipConfirm) Toast.info('Semua nomor sudah terverifikasi.');
          return;
        }

        GlobalProgress.show(contactsToVerify.length, 'verify');

        let success = 0;
        let failed = 0;

        for (let i = 0; i < contactsToVerify.length; i++) {
          const contact = contactsToVerify[i];

          try {
            // Panggil API Verifikasi Asli (Baileys onWhatsApp)
            const verifyRes = await ContactAPI.verify(contact.id);
            if (verifyRes.status === 1) success++; else failed++;
          } catch (err) {
            failed++;
          }

          GlobalProgress.update(i + 1, success, failed, contactsToVerify.length);

          // Jeda sesuai pengaturan (delay + random)
          if (i < contactsToVerify.length - 1) {
            const waitTime = delay + Math.floor(Math.random() * random);
            await new Promise(r => setTimeout(r, waitTime));
          }
        }

        setTimeout(() => {
          GlobalProgress.hide();
          Toast.success(`Verifikasi selesai: ${success} Terdaftar, ${failed} Tidak Terdaftar.`);
          document.dispatchEvent(new CustomEvent('table:reload'));
          this.refreshVerifyButtonVisibility();
        }, 2000);

      } catch (e) {
        Toast.error('Gagal menjalankan verifikasi');
      } finally {
        window.isVerifying = false;
        document.dispatchEvent(new CustomEvent('verifying:status-updated', { detail: { isVerifying: false } }));
        this.updateButtonStates();
      }
    };

    if (skipConfirm) {
      return startVerification();
    }

    Modal.confirm({
      title: 'Verifikasi Nomor?',
      message: 'Sistem akan memeriksa semua nomor yang belum diverifikasi apakah terdaftar di WhatsApp. Proses ini akan berjalan di latar belakang.',
      onConfirm: startVerification
    });
  },
  async handleBulkAddTags(ids) {
    if (!ids || ids.length === 0) return;

    let tags = [];
    try {
      const res = await TagAPI.list({ limit: 100 });
      tags = res.rows || (Array.isArray(res) ? res : []);
    } catch (e) {
      console.warn('Gagal memuat tags:', e);
    }

    const selectedTags = new Set();

    Modal.open({
      title: `Tambah Tag ke ${ids.length} Kontak`,
      body: `
        <div class="form-group">
          <label class="form-label">Pilih Tag yang ingin ditambahkan</label>
          <p class="text-muted" style="font-size: 11px; margin-bottom: 12px;">Tag yang Anda pilih akan ditambahkan ke kontak-kontak yang sudah Anda pilih di tabel.</p>
          <div class="tag-selector">
            ${tags.length > 0 ? tags.map(tag => `
              <div class="tag-badge-item inactive" data-tag="${tag.name}">${tag.name}</div>
            `).join('') : '<p class="text-muted" style="font-size: 12px;">Belum ada tags tersedia. Silakan buat di tab Daftar Tags.</p>'}
          </div>
        </div>
      `,
      confirmText: 'Tambah Tag',
      onConfirm: async () => {
        if (selectedTags.size === 0) {
          Toast.error('Pilih setidaknya satu tag');
          return;
        }

        try {
          const tagString = Array.from(selectedTags).join(',');
          await ContactAPI.bulkAddTags(ids, tagString);
          Toast.success(`Berhasil menambahkan tag ke ${ids.length} kontak`);
          document.dispatchEvent(new CustomEvent('table:reload'));
        } catch (e) {
          Toast.error('Gagal menambahkan tag: ' + e.message);
        }
      }
    });

    // Pasang listener klik untuk setiap badge tag
    document.querySelectorAll('.tag-badge-item').forEach(el => {
      el.onclick = () => {
        const tag = el.dataset.tag;
        if (selectedTags.has(tag)) {
          selectedTags.delete(tag);
          el.classList.remove('active');
          el.classList.add('inactive');
        } else {
          selectedTags.add(tag);
          el.classList.add('active');
          el.classList.remove('inactive');
        }
      };
    });
  },

  handleBulkDelete(ids) {
    if (!ids || ids.length === 0) return;
    Modal.confirm({
      title: 'Hapus Kontak Terpilih?',
      message: `Anda yakin ingin menghapus ${ids.length} kontak terpilih? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          const res = await ContactAPI.bulkDelete(ids);
          Toast.success(`${res.deleted || ids.length} kontak berhasil dihapus`);
          document.dispatchEvent(new CustomEvent('table:reload'));
        } catch (e) {
          Toast.error('Gagal menghapus kontak: ' + e.message);
        }
      }
    });
  },

  handleBulkDeleteTags(ids) {
    if (!ids || ids.length === 0) return;
    Modal.confirm({
      title: 'Hapus Tags Terpilih?',
      message: `Anda yakin ingin menghapus ${ids.length} tags terpilih? Kontak yang menggunakan tags ini akan tetap ada, namun label tag-nya akan hilang.`,
      confirmText: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          const res = await TagAPI.bulkDelete(ids);
          Toast.success(`${res.deleted || ids.length} tags berhasil dihapus`);
          document.dispatchEvent(new CustomEvent('table:reload'));
        } catch (e) {
          Toast.error('Gagal menghapus tags: ' + e.message);
        }
      }
    });
  }
};

export default Contacts;
