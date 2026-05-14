import { BlastAPI } from '../services/api.js';
import Table from '../components/Table.js';

const History = {
  async mount(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Riwayat Blast</h1>
      </div>

      <div class="stats-grid" style="margin-bottom: var(--space-6);">
        <div class="stat-card">
          <div class="stat-icon" style="color: var(--success); background: rgba(76, 175, 130, 0.1);">
            <i class='bx bx-check-double'></i>
          </div>
          <div>
            <p class="stat-label">Total Terkirim</p>
            <p class="stat-value" id="total-sent">0</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color: var(--danger); background: rgba(224, 92, 92, 0.1);">
            <i class='bx bx-error-circle'></i>
          </div>
          <div>
            <p class="stat-label">Gagal</p>
            <p class="stat-value" id="total-failed">0</p>
          </div>
        </div>
      </div>

      <div id="history-table-container"></div>
    `;

    // Inisialisasi Tabel
    Table.create({
      el: document.getElementById('history-table-container'),
      columns: [
        {
          label: 'Waktu',
          key: 'created_at',
          sortable: true,
          render: (val) => {
            const d = new Date(val);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const day = d.getDate();
            const month = months[d.getMonth()];
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `<span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 11px;">${day} ${month} ${year}, ${hours}.${minutes}</span>`;
          }
        },
        {
          label: 'Nama',
          key: 'name',
          sortable: true,
          render: (val) => `<strong>${val || 'unknown'}</strong>`
        },
        {
          label: 'Nomor',
          key: 'phone',
          sortable: true,
          render: (val) => `<code>${val}</code>`
        },
        {
          label: 'Pesan',
          key: 'message',
          sortable: true,
          render: (val) => `<div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted);" title="${val}">${val}</div>`
        },
        {
          label: 'Status',
          key: 'status',
          sortable: true,
          render: (val) => {
            const isSuccess = val === 'success';
            return `
              <span style="padding: 2px 8px; border-radius: var(--radius-full); font-size: 10px; font-weight: 700; text-transform: uppercase; background: ${isSuccess ? 'rgba(76, 175, 130, 0.1)' : 'rgba(224, 92, 92, 0.1)'}; color: ${isSuccess ? 'var(--success)' : 'var(--danger)'}; border: 1px solid ${isSuccess ? 'var(--success)' : 'var(--danger)'};">
                ${isSuccess ? 'Terkirim' : 'Gagal'}
              </span>
            `;
          }
        }
      ],
      fetchData: async (params) => {
        const history = await BlastAPI.history(params);
        
        // Update stats cards directly from server response (safeguard for DOM presence)
        const sentEl = document.getElementById('total-sent');
        const failedEl = document.getElementById('total-failed');
        
        if (sentEl) sentEl.textContent = history.totalSent || 0;
        if (failedEl) failedEl.textContent = history.totalFailed || 0;

        return history;
      },
      options: {
        itemsPerPage: 10,
        defaultSort: { key: 'created_at', dir: 'desc' }
      }
    });
  }
};

export default History;
