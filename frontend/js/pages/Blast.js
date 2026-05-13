import { ContactAPI, TagAPI, BlastAPI, SettingAPI } from '../services/api.js';
import Table from '../components/Table.js';
import Modal from '../components/Modal.js';
import Toast from '../components/Toast.js';
import GlobalProgress from '../components/global-progress.js';

const Blast = {
  activeTab: 'blast', // 'blast' or 'templates'
  isSending: false,
  isVerifying: false, // assuming we might need this from global state
  tags: [],
  contacts: [],

  async mount(container) {
    this.container = container;
    this.isVerifying = window.isVerifying || false;

    // Cleanup existing listeners if any
    if (this.abortCtrl) this.abortCtrl.abort();
    this.abortCtrl = new AbortController();

    await this.loadData();
    this.renderBase();
    this.initTabs();
    this.switchTab(this.activeTab);
    this.initEventListeners(this.abortCtrl.signal);

    // Clean up when the container is unmounted (if the router supports it)
    container.addEventListener('unmount', () => this.abortCtrl.abort(), { once: true });
  },

  async loadData() {
    try {
      const [tagsRes, contactsRes] = await Promise.all([
        TagAPI.list({ limit: 1000 }),
        ContactAPI.list({ limit: 1000 })
      ]);
      this.tags = tagsRes.rows || [];
      this.contacts = contactsRes.rows || [];
    } catch (err) {
      console.error('[Blast] Failed to load tags/contacts:', err);
    }
  },

  renderBase() {
    this.container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Blast Pesan</h1>
      </div>

      <div class="tabs-header">
        <button class="tab-link active" data-tab="blast">Kirim Blast</button>
        <button class="tab-link" data-tab="templates">Template</button>
      </div>

      <div id="blast-content-container">
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
    const links = this.container.querySelectorAll('.tab-link');
    links.forEach(link => {
      link.classList.toggle('active', link.dataset.tab === tab);
    });

    const content = this.container.querySelector('#blast-content-container');
    content.innerHTML = '<div class="tab-content active"></div>';
    const tabEl = content.querySelector('.tab-content');

    if (tab === 'blast') {
      this.renderBlastTab(tabEl);
    } else {
      this.renderTemplatesTab(tabEl);
    }
  },

  // ── Tab: Kirim Blast ────────────────────────────────────────────────────────

  renderBlastTab(container) {
    container.innerHTML = `
      <div class="blast-form-card">
        <div class="form-group relative">
          <label class="form-label">Kirim Ke</label>
          <div class="input-tags-wrapper">
             <input type="text" id="blast-recipient-input" class="form-input" placeholder="#tags, @nama, atau nomor (pisahkan dengan koma)" autocomplete="off">
             <div id="suggestion-dropdown" class="suggestion-dropdown" style="display: none;"></div>
          </div>
          <small class="helper-text">Format: #tag, @kontak, 0812xxx. Anda bisa mencampur ketiganya.</small>
        </div>

        <div class="form-group">
          <label class="form-label mb-1">Pesan Text <small class="text-muted" style="font-weight: 400; margin-left: 8px;">(Contoh: Halo {{nama}}, apa kabar?)</small></label>
          <div class="textarea-wrapper">
            <textarea id="blast-message-textarea" class="form-input" style="height: 200px;" placeholder="Tulis pesan Anda di sini..." maxlength="30000"></textarea>
            <div class="textarea-footer">
               <div class="flex gap-2">
                  <button class="btn-toolbar" id="btn-emoji" title="Tambah Emoji">
                    <i class='bx bx-smile'></i>
                  </button>
                  <button class="btn-toolbar" id="btn-use-template" title="Gunakan Template">
                    <i class='bx bx-layout'></i> Template
                  </button>
               </div>
               <div class="text-muted" style="font-size: 11px; font-weight: 500;">
                  <span id="char-count">0</span>/3000
               </div>
            </div>
          </div>
        </div>

        <div class="mt-8">
          <button id="btn-send-blast" class="btn btn-success btn-lg w-full" disabled style="height: 48px; font-size: 16px;">
            <i class='bx bx-paper-plane'></i> Kirim Blast
          </button>
        </div>
      </div>
    `;

    this.initBlastLogic(container);
  },

  initBlastLogic(container) {
    const input = container.querySelector('#blast-recipient-input');
    const textarea = container.querySelector('#blast-message-textarea');
    const dropdown = container.querySelector('#suggestion-dropdown');
    const btnSend = container.querySelector('#btn-send-blast');
    const charCount = container.querySelector('#char-count');
    const btnEmoji = container.querySelector('#btn-emoji');
    const btnTemplate = container.querySelector('#btn-use-template');

    // Suggestion logic
    input.oninput = (e) => {
      const value = e.target.value;
      const cursorIdx = e.target.selectionStart;
      const textBeforeCursor = value.substring(0, cursorIdx);
      const parts = textBeforeCursor.split(/[\s,]+/);
      const lastPart = parts[parts.length - 1];

      if (lastPart.startsWith('#')) {
        this.showSuggestions(lastPart.substring(1), 'tag', dropdown, input);
      } else if (lastPart.startsWith('@')) {
        this.showSuggestions(lastPart.substring(1), 'contact', dropdown, input);
      } else {
        dropdown.style.display = 'none';
      }
      this.updateSendButtonState();
    };

    textarea.oninput = () => {
      const len = textarea.value.length;
      charCount.textContent = len;
      this.updateSendButtonState();
    };

    btnSend.onclick = () => this.handleSendBlast();
    btnEmoji.onclick = (e) => this.toggleEmojiPicker(e, textarea);
    btnTemplate.onclick = () => this.openTemplatePicker(textarea);

    // Initial state check
    this.updateSendButtonState();
  },

  showSuggestions(query, type, dropdown, input) {
    const q = query.toLowerCase();
    let matches = [];

    if (type === 'tag') {
      matches = this.tags.filter(t => t.name.toLowerCase().includes(q));
    } else {
      matches = this.contacts.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
      // Tambahkan opsi @all
      if ('all'.includes(q)) {
        matches.unshift({ name: 'all', phone: 'Semua Kontak Terverifikasi' });
      }
    }

    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = matches.map(m => `
      <div class="suggestion-item" data-value="${type === 'tag' ? '#' + m.name : '@' + m.name}">
        <div class="suggestion-icon"><i class='bx bx-${type === 'tag' ? 'hash' : 'user'}'></i></div>
        <div class="suggestion-info">
          <div class="suggestion-name">${m.name}</div>
          ${type === 'contact' ? `<div class="suggestion-sub">${m.phone}</div>` : ''}
        </div>
      </div>
    `).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.suggestion-item').forEach(item => {
      item.onclick = () => {
        const val = item.dataset.value;
        const currentVal = input.value;
        const cursorIdx = input.selectionStart;

        // Find the start of the last token (# or @)
        const textBeforeCursor = currentVal.substring(0, cursorIdx);
        const lastSymbolIdx = Math.max(textBeforeCursor.lastIndexOf('#'), textBeforeCursor.lastIndexOf('@'));

        if (lastSymbolIdx !== -1) {
          const newVal = currentVal.substring(0, lastSymbolIdx) + val + currentVal.substring(cursorIdx);
          input.value = newVal;
          input.focus();
        }

        dropdown.style.display = 'none';
        this.updateSendButtonState();
      };
    });
  },

  updateSendButtonState() {
    const btnSend = document.getElementById('btn-send-blast');
    if (!btnSend) return;

    const input = document.getElementById('blast-recipient-input');
    const textarea = document.getElementById('blast-message-textarea');

    const isRecipientEmpty = !input || !input.value.trim();
    const isMessageEmpty = !textarea || !textarea.value.trim();

    const isConnected = window.isWaConnected || false;
    const isReconnecting = window.isWaReconnecting || false;
    const isVerifying = window.isVerifying || false;
    const isSending = this.isSending;

    const isDisabled = isRecipientEmpty || isMessageEmpty || !isConnected || isReconnecting || isVerifying || isSending;

    btnSend.disabled = isDisabled;

    // Update Label / Spinner
    if (isSending) {
      btnSend.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Mengirim Blast...`;
    } else if (isReconnecting) {
      btnSend.innerHTML = `<i class='bx bx-sync bx-spin'></i> Reconnecting...`;
    } else if (isVerifying) {
      btnSend.innerHTML = `<i class='bx bx-check-shield bx-spin'></i> Verifikasi Nomor...`;
    } else if (!isConnected) {
      btnSend.innerHTML = `<i class='bx bx-wifi-off'></i> WhatsApp Belum Konek`;
    } else {
      btnSend.innerHTML = `<i class='bx bx-paper-plane'></i> Kirim Blast`;
    }
  },

  async handleSendBlast() {
    const recipients = document.getElementById('blast-recipient-input').value;
    const message = document.getElementById('blast-message-textarea').value;

    if (!recipients || !message) return;

    Modal.open({
      title: 'Konfirmasi Blast',
      body: `<p>Anda akan mengirim pesan blast ke <strong>${recipients}</strong>. Lanjutkan?</p>`,
      confirmText: 'Kirim Sekarang',
      onConfirm: async () => {
        this.isSending = true;
        this.updateSendButtonState();

        try {
          const res = await BlastAPI.start({ recipients, message });
          Toast.success('Blast berhasil dimulai! Cek riwayat untuk status detail.');

          // Show Global Progress immediately
          GlobalProgress.show(0, 'blast');

          // Clear form
          document.getElementById('blast-recipient-input').value = '';
          document.getElementById('blast-message-textarea').value = '';
          document.getElementById('char-count').textContent = '0 kata';

        } catch (err) {
          Toast.error('Gagal mengirim blast: ' + err.message);
        } finally {
          this.updateSendButtonState();
        }
      }
    });
  },

  toggleEmojiPicker(e, textarea) {
    // Extended emoji picker implementation
    const emojis = [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😻', '😼', '😽', '🙀', '😿', '😾',
      '👐', '🙌', '👏', '🙏', '🤝', '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤙', '💪', '🖕', '✍️', '🤳', '💅', '💍', '💄', '💋', '👄', '👅', '👂', '👃', '👣', '👁', '👀', '🧠', '🦴', '🦷', '🗣', '👤', '👥',
      '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳‍♂️', '🧕', '🧔', '👱‍♀️', '👱‍♂️', '👨‍🦰', '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸‍♀️', '🦸‍♂️', '🦹‍♀️', '🦹‍♂️', '🧙‍♀️', '🧙‍♂️', '🧚‍♀️', '🧚‍♂️', '🧛‍♀️', '🧛‍♂️', '🧜‍♀️', '🧜‍♂️', '🧝‍♀️', '🧝‍♂️', '🧞‍♀️', '🧞‍♂️', '🧟‍♀️', '🧟‍♂️',
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦢', '🦉', '🦚', '🦜', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🕊', '🐇', '🐁', '🐀', '🐿', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌪', '🌈', '☀️', '🌤', '⛅️', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '❄️', '☃️', '⛄️', '🌬', '💨', '💧', '💦', '☔️', '☂️', '🌊', '🌫'
    ];

    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.innerHTML = emojis.map(em => `<span class="emoji-item">${em}</span>`).join('');

    // Position picker ABOVE the button (popping upwards)
    const rect = e.currentTarget.getBoundingClientRect();
    picker.style.bottom = `${window.innerHeight - rect.top + 5}px`;
    picker.style.left = `${rect.left}px`;

    document.body.appendChild(picker);

    const closePicker = (event) => {
      if (!picker.contains(event.target) && event.target !== e.currentTarget) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    };

    setTimeout(() => document.addEventListener('click', closePicker), 0);

    picker.querySelectorAll('.emoji-item').forEach(item => {
      item.onclick = () => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        textarea.value = text.substring(0, start) + item.textContent + text.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + item.textContent.length;
        picker.remove();
        document.removeEventListener('click', closePicker);
      };
    });
  },

  async openTemplatePicker(textarea) {
    try {
      const res = await BlastAPI.templates();
      const allTemplates = res.rows || (Array.isArray(res) ? res : []);

      if (allTemplates.length === 0) {
        Toast.info('Belum ada template. Silakan buat di tab Template.');
        return;
      }

      Modal.open({
        title: 'Pilih Template',
        body: `
          <div class="mb-4 relative">
            <i class='bx bx-search' style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 18px;"></i>
            <input type="text" id="template-search" class="form-input" style="padding-left: 36px;" placeholder="Cari nama atau isi template..." autocomplete="off">
          </div>
          <div class="template-list" id="template-picker-list" style="max-height: 380px; overflow-y: auto;">
            <!-- templates will be rendered here -->
          </div>
        `,
        confirmText: 'Pilih',
        cancelText: 'Tutup',
      });

      const listEl = document.getElementById('template-picker-list');
      const searchInput = document.getElementById('template-search');

      const render = (list) => {
        if (list.length === 0) {
          listEl.innerHTML = '<p class="text-center text-muted p-8">Tidak ada template yang cocok.</p>';
          return;
        }

        listEl.innerHTML = list.map(t => `
          <div class="template-pick-item" data-id="${t.id}">
            <strong>${t.name}</strong>
            <p>${(t.body || '').substring(0, 150)}${(t.body || '').length > 150 ? '...' : ''}</p>
          </div>
        `).join('');

        // Attach listeners via delegation or direct
        listEl.querySelectorAll('.template-pick-item').forEach(item => {
          item.onclick = () => {
            const id = item.dataset.id;
            const template = allTemplates.find(t => t.id == id);
            if (template) {
              textarea.value = template.body || '';
              textarea.dispatchEvent(new Event('input'));
              Modal.close();
            }
          };
        });
      };

      // Initial render
      render(allTemplates);

      // Real-time search
      searchInput.oninput = (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allTemplates.filter(t =>
          t.name.toLowerCase().includes(q) ||
          (t.body || '').toLowerCase().includes(q)
        );
        render(filtered);
      };

      // Auto focus search
      setTimeout(() => searchInput.focus(), 100);

    } catch (err) {
      Toast.error('Gagal memuat template');
    }
  },

  // ── Tab: Templates ─────────────────────────────────────────────────────────

  async renderTemplatesTab(container) {
    container.innerHTML = `
      <div id="templates-table"></div>
    `;

    const tableEl = container.querySelector('#templates-table');

    await Table.create({
      el: tableEl,
      columns: [
        { label: 'Nama Template', key: 'name', sortable: true, render: (v) => `<strong>${v}</strong>` },
        { label: 'Pesan', key: 'body', render: (v) => `<div class="text-truncate" style="max-width: 400px;">${v || ''}</div>` },
        {
          label: 'Aksi',
          key: 'id',
          render: (id) => `
            <div class="flex gap-2">
              <button class="action-btn" title="Gunakan" onclick="window.handleUseTemplate('${id}')">
                <i class='bx bx-send'></i>
              </button>
              <button class="action-btn edit" title="Edit" onclick="window.handleEditTemplate('${id}')">
                <i class='bx bx-edit-alt'></i>
              </button>
              <button class="action-btn delete" title="Hapus" onclick="window.handleDeleteTemplate('${id}')">
                <i class='bx bx-trash'></i>
              </button>
            </div>
          `
        }
      ],
      fetchData: async (params) => {
        const res = await BlastAPI.templates(params);
        return res;
      },
      options: {
        itemsPerPage: 10,
        customActions: `
          <button class="btn btn-primary" id="btn-add-template">
            <i class='bx bx-plus'></i> Tambah Template
          </button>
        `
      }
    });

    tableEl.querySelector('#btn-add-template').onclick = () => this.openAddTemplateModal();

    window.handleUseTemplate = (id) => {
      this.useTemplate(id);
    };

    window.handleEditTemplate = (id) => {
      this.openEditTemplateModal(id);
    };

    window.handleDeleteTemplate = (id) => {
      Modal.open({
        title: 'Hapus Template?',
        body: '<p>Template yang dihapus tidak dapat dikembalikan.</p>',
        confirmText: 'Hapus',
        onConfirm: async () => {
          try {
            await BlastAPI.deleteTemplate(id);
            Toast.success('Template berhasil dihapus');
            document.dispatchEvent(new CustomEvent('table:reload'));
          } catch (e) {
            Toast.error('Gagal menghapus template');
          }
        }
      });
    };
  },

  async useTemplate(id) {
    try {
      const res = await BlastAPI.templates();
      const templates = res.rows || (Array.isArray(res) ? res : []);
      const template = templates.find(t => t.id == id);
      if (template) {
        this.activeTab = 'blast';
        this.switchTab('blast');
        setTimeout(() => {
          const textarea = document.getElementById('blast-message-textarea');
          if (textarea) {
            textarea.value = template.body || '';
            textarea.dispatchEvent(new Event('input'));
          }
        }, 100);
      }
    } catch (err) {
      Toast.error('Gagal menggunakan template');
    }
  },

  openAddTemplateModal() {
    Modal.open({
      title: 'Tambah Template Baru',
      size: 'lg',
      body: `
        <form id="form-add-template">
          <div class="form-group">
            <label class="form-label">Nama Template</label>
            <input type="text" name="name" class="form-input" placeholder="Contoh: Ucapan Selamat Datang" required>
          </div>
          <div class="form-group">
            <label class="form-label">Isi Pesan <small class="text-muted" style="font-weight: 400; margin-left: 8px;">(Contoh: Halo {{nama}}, apa kabar?)</small></label>
            <div class="textarea-wrapper">
              <textarea name="message" id="modal-template-textarea" class="form-input" style="height: 200px;" placeholder="Halo {{nama}}, selamat bergabung..." required></textarea>
              <div class="textarea-footer">
                <div class="flex gap-2">
                  <button type="button" class="btn-toolbar" id="btn-modal-emoji" title="Tambah Emoji">
                    <i class='bx bx-smile'></i>
                  </button>
                </div>
                <div class="text-muted" style="font-size: 11px; font-weight: 500;">
                  <span id="modal-char-count">0</span>/3000
                </div>
              </div>
            </div>
          </div>
        </form>
      `,
      confirmText: 'Simpan Template',
    });

    // Initialize Modal Logic
    const textarea = document.getElementById('modal-template-textarea');
    const charCount = document.getElementById('modal-char-count');
    const btnEmoji = document.getElementById('btn-modal-emoji');

    textarea.oninput = () => {
      charCount.textContent = textarea.value.length;
    };

    btnEmoji.onclick = (e) => this.toggleEmojiPicker(e, textarea);

    // Update onConfirm logic
    document.getElementById('modal-confirm').onclick = async () => {
      const form = document.getElementById('form-add-template');
      const formData = new FormData(form);
      const data = {
        name: formData.get('name'),
        body: formData.get('message'),
      };

      try {
        await BlastAPI.createTemplate(data);
        Toast.success('Template berhasil disimpan');
        document.dispatchEvent(new CustomEvent('table:reload'));
        Modal.close();
      } catch (e) {
        Toast.error('Gagal menyimpan template');
      }
    };
  },

  async openEditTemplateModal(id) {
    try {
      const res = await BlastAPI.templates();
      const templates = res.rows || (Array.isArray(res) ? res : []);
      const template = templates.find(t => t.id == id);

      if (!template) throw new Error('Template tidak ditemukan');

      Modal.open({
        title: 'Edit Template',
        size: 'lg',
        body: `
          <form id="form-edit-template">
            <div class="form-group">
              <label class="form-label">Nama Template</label>
              <input type="text" name="name" class="form-input" value="${template.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Isi Pesan <small class="text-muted" style="font-weight: 400; margin-left: 8px;">(Contoh: Halo {{nama}}, apa kabar?)</small></label>
              <div class="textarea-wrapper">
              <textarea name="message" id="modal-edit-textarea" class="form-input" style="height: 200px;" required>${template.body || template.message || ''}</textarea>
                <div class="textarea-footer">
                  <div class="flex gap-2">
                    <button type="button" class="btn-toolbar" id="btn-edit-emoji" title="Tambah Emoji">
                      <i class='bx bx-smile'></i>
                    </button>
                  </div>
                  <div class="text-muted" style="font-size: 11px; font-weight: 500;">
                    <span id="edit-char-count">${(template.body || template.message || '').length}</span>/3000
                  </div>
                </div>
              </div>
            </div>
          </form>
        `,
        confirmText: 'Update Template',
      });

      // Initialize Modal Logic
      const textarea = document.getElementById('modal-edit-textarea');
      const charCount = document.getElementById('edit-char-count');
      const btnEmoji = document.getElementById('btn-edit-emoji');

      textarea.oninput = () => {
        charCount.textContent = textarea.value.length;
      };

      btnEmoji.onclick = (e) => this.toggleEmojiPicker(e, textarea);

      // Update onConfirm logic
      document.getElementById('modal-confirm').onclick = async () => {
        const form = document.getElementById('form-edit-template');
        const formData = new FormData(form);
        const data = {
          name: formData.get('name'),
          body: formData.get('message'),
        };

        try {
          await BlastAPI.updateTemplate(id, data);
          Toast.success('Template berhasil diperbarui');
          document.dispatchEvent(new CustomEvent('table:reload'));
          Modal.close();
        } catch (e) {
          Toast.error('Gagal memperbarui template');
        }
      };
    } catch (e) {
      Toast.error('Gagal memuat data template');
    }
  },

  initEventListeners(signal) {
    // Listen for global WA status updates to enable/disable buttons
    const updateHandler = () => this.updateSendButtonState();
    document.addEventListener('wa:status-updated', updateHandler, { signal });
    document.addEventListener('wa:ready', updateHandler, { signal });
    document.addEventListener('wa:disconnected', updateHandler, { signal });

    // Listen for global verification state
    document.addEventListener('verifying:status-updated', (e) => {
      window.isVerifying = e.detail.isVerifying;
      this.updateSendButtonState();
    }, { signal });

    // Listen for blast progress from backend (IPC/SSE)
    document.addEventListener('blast:progress', (e) => {
      const { sent, failed, total } = e.detail;
      GlobalProgress.update(sent + failed, sent, failed, total);
    }, { signal });

    document.addEventListener('blast:done', (e) => {
      setTimeout(() => {
        GlobalProgress.hide();
        this.isSending = false;
        this.updateSendButtonState();
      }, 2000);
    }, { signal });
  },
};

export default Blast;
