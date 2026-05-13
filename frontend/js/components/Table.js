/**
 * Reusable Table Component for KenWA
 * Features: Sorting, Real-time Search, Pagination, Auto-reload.
 */

const Table = {
  /**
   * Render table to element
   * @param {Object} config
   * @param {HTMLElement} config.el - Container element
   * @param {Array} config.columns - Column definitions [{label, key, sortable, render}]
   * @param {Function} config.fetchData - Function that returns data array
   * @param {Object} config.options - { itemsPerPage, defaultSort }
   */
  async create({ el, columns, fetchData, options = {} }) {
    if (!el) return;

    const state = {
      rawData: [],
      filteredData: [],
      currentPage: 1,
      itemsPerPage: options.itemsPerPage || 10,
      searchQuery: '',
      sortKey: options.defaultSort?.key || '',
      sortDir: options.defaultSort?.dir || 'asc',
      selectedIds: new Set(),
    };

    const renderLayout = () => {
      el.innerHTML = `
        <div class="table-wrapper">
          <div class="table-actions" style="display: flex; justify-content: space-between; margin-bottom: var(--space-4); gap: var(--space-4);">
            <div class="search-box" style="position: relative; flex: 1; max-width: 300px;">
              <i class='bx bx-search' style="position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
              <input type="text" id="table-search" placeholder="Cari data..." class="form-input" style="padding-left: var(--space-10);">
            </div>
            <div id="table-custom-actions" class="flex gap-4 align-center">
              ${options.customActions || ''}
            </div>
          </div>

          <div class="table-container" style="background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border);">
                  ${options.selectable ? `
                    <th style="padding: var(--space-4); width: 50px; text-align: center; vertical-align: middle;">
                      <div style="display: flex; align-items: center; justify-content: center;">
                        <label class="custom-checkbox">
                          <input type="checkbox" id="table-select-all">
                          <span class="checkbox-custom"></span>
                        </label>
                      </div>
                    </th>
                  ` : ''}
                  ${columns.map(col => `
                    <th class="sortable-header" data-key="${col.key}" style="padding: var(--space-4); text-align: left; vertical-align: middle; font-size: var(--text-sm); text-transform: uppercase; color: var(--text-muted); cursor: ${col.sortable ? 'pointer' : 'default'}; user-select: none;">
                      <div style="display: flex; align-items: center; gap: var(--space-1);">
                        ${col.label}
                        ${col.sortable ? `<i class='bx ${state.sortKey === col.key ? (state.sortDir === 'asc' ? 'bx-sort-up' : 'bx-sort-down') : 'bx-sort-alt-2'}'></i>` : ''}
                      </div>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody id="table-body">
                <tr><td colspan="${columns.length + (options.selectable ? 1 : 0)}" style="padding: var(--space-10); text-align: center;"><i class='bx bx-loader-alt bx-spin'></i> Memuat data...</td></tr>
              </tbody>
            </table>
          </div>

          <div class="table-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-4);">
            <div class="table-info" style="font-size: var(--text-xs); color: var(--text-muted);"></div>
            <div class="table-pagination" style="display: flex; gap: var(--space-2);"></div>
          </div>
        </div>
      `;

      // Event: Search
      const searchInput = el.querySelector('#table-search');
      searchInput.value = state.searchQuery;
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          state.searchQuery = e.target.value.toLowerCase();
          state.currentPage = 1;
          refreshData();
        }, 300); // Debounce search
      });

      // Event: Sort
      el.querySelectorAll('.sortable-header').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.key;
          const col = columns.find(c => c.key === key);
          if (!col || !col.sortable) return;

          if (state.sortKey === key) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortKey = key;
            state.sortDir = 'asc';
          }

          // Hanya update ikon sortir — JANGAN panggil renderLayout()
          // karena renderLayout() akan mereset semua tombol customActions ke display:none
          el.querySelectorAll('.sortable-header').forEach(header => {
            const hKey = header.dataset.key;
            const hCol = columns.find(c => c.key === hKey);
            if (!hCol?.sortable) return;
            const icon = header.querySelector('i.bx');
            if (icon) {
              icon.className = `bx ${state.sortKey === hKey ? (state.sortDir === 'asc' ? 'bx-sort-up' : 'bx-sort-down') : 'bx-sort-alt-2'}`;
            }
          });

          refreshData();
        });
      });

      // Event: Select All
      if (options.selectable) {
        const selectAll = el.querySelector('#table-select-all');
        if (selectAll) {
          selectAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            const checkboxes = el.querySelectorAll('.table-row-select');
            checkboxes.forEach(cb => {
              cb.checked = checked;
              if (checked) state.selectedIds.add(cb.value);
              else state.selectedIds.delete(cb.value);
            });
            document.dispatchEvent(new CustomEvent('table:selectionChange', { detail: Array.from(state.selectedIds) }));

          });
        }
      }
    };

    const renderRows = () => {
      const tbody = el.querySelector('#table-body');
      const pageData = state.filteredData;

      const start = (state.currentPage - 1) * state.itemsPerPage;
      const end = start + pageData.length;

      if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${columns.length + (options.selectable ? 1 : 0)}" style="padding: var(--space-10); text-align: center; color: var(--text-muted);">Data tidak ditemukan</td></tr>`;

        const info = el.querySelector('.table-info');
        if (info) info.textContent = `Menampilkan 0 dari 0 data`;
        return;
      }

      tbody.innerHTML = pageData.map(item => `
        <tr style="border-bottom: 1px solid var(--border); transition: background var(--ease-fast);" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='transparent'">
          ${options.selectable ? `
            <td style="padding: var(--space-2) var(--space-4); text-align: center; vertical-align: middle;">
              <div style="display: flex; align-items: center; justify-content: center;">
                <label class="custom-checkbox">
                  <input type="checkbox" class="table-row-select" value="${item.id}" ${state.selectedIds.has(String(item.id)) ? 'checked' : ''}>
                  <span class="checkbox-custom"></span>
                </label>
              </div>
            </td>
          ` : ''}
          ${columns.map(col => `
            <td style="padding: var(--space-2) var(--space-4); vertical-align: middle; font-size: var(--text-sm);">
              ${col.render ? col.render(item[col.key], item) : (item[col.key] || '-')}
            </td>
          `).join('')}
        </tr>
      `).join('');

      // Update info
      const info = el.querySelector('.table-info');
      const total = state.totalItems;
      if (info) info.textContent = `Menampilkan ${start + 1} sampai ${end} dari ${total} data`;

      // Update Select All Checkbox State
      if (options.selectable) {
        const selectAll = el.querySelector('#table-select-all');
        const allSelectedOnPage = pageData.length > 0 && pageData.every(item => state.selectedIds.has(String(item.id)));
        if (selectAll) selectAll.checked = allSelectedOnPage;

        el.querySelectorAll('.table-row-select').forEach(cb => {
          cb.addEventListener('change', (e) => {
            if (e.target.checked) state.selectedIds.add(e.target.value);
            else state.selectedIds.delete(e.target.value);

            if (selectAll) selectAll.checked = Array.from(el.querySelectorAll('.table-row-select')).every(c => c.checked);
            document.dispatchEvent(new CustomEvent('table:selectionChange', { detail: Array.from(state.selectedIds) }));

          });
        });
      }
    };

    const renderPagination = () => {
      const footer = el.querySelector('.table-pagination');
      if (!footer) return;

      const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);

      if (totalPages <= 1) {
        footer.innerHTML = '';
        return;
      }

      let btns = '';

      // Tombol Previous
      btns += `
        <button class="btn btn-secondary" style="height: 32px; padding: 0 8px; display: flex; align-items: center; justify-content: center;"
                data-action="prev" ${state.currentPage === 1 ? 'disabled' : ''}>
          <i class='bx bx-chevron-left'></i>
        </button>
      `;

      // Kalkulasi window paginasi (maksimal tampil 5 halaman)
      let startPage = Math.max(1, state.currentPage - 2);
      let endPage = Math.min(totalPages, startPage + 4);
      if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
      }

      if (startPage > 1) {
        btns += `<button class="btn btn-secondary" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" data-page="1">1</button>`;
        if (startPage > 2) btns += `<span style="padding: 0 4px; color: var(--text-muted); display:flex; align-items:flex-end;">...</span>`;
      }

      for (let i = startPage; i <= endPage; i++) {
        btns += `
          <button class="btn ${state.currentPage === i ? 'btn-primary' : 'btn-secondary'}" 
                  style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;"
                  data-page="${i}">
            ${i}
          </button>
        `;
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) btns += `<span style="padding: 0 4px; color: var(--text-muted); display:flex; align-items:flex-end;">...</span>`;
        btns += `<button class="btn btn-secondary" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;" data-page="${totalPages}">${totalPages}</button>`;
      }

      // Tombol Next
      btns += `
        <button class="btn btn-secondary" style="height: 32px; padding: 0 8px; display: flex; align-items: center; justify-content: center;"
                data-action="next" ${state.currentPage === totalPages ? 'disabled' : ''}>
          <i class='bx bx-chevron-right'></i>
        </button>
      `;

      footer.innerHTML = btns;

      footer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const action = btn.dataset.action;
          if (action === 'prev') state.currentPage = Math.max(1, state.currentPage - 1);
          else if (action === 'next') state.currentPage = Math.min(totalPages, state.currentPage + 1);
          else state.currentPage = parseInt(btn.dataset.page);

          refreshData();
        });
      });
    };

    const refreshData = async () => {
      // Tampilkan loading state
      const tbody = el.querySelector('#table-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${columns.length + (options.selectable ? 1 : 0)}" style="padding: var(--space-10); text-align: center;"><i class='bx bx-loader-alt bx-spin'></i> Memuat data...</td></tr>`;
      }

      let response;
      try {
        response = await fetchData({
          page: state.currentPage,
          limit: state.itemsPerPage,
          search: state.searchQuery,
          sortKey: state.sortKey,
          sortDir: state.sortDir
        });

        // Handle both format: {rows: [], total: 0} (Server-side) atau Array biasa (Client-side fallback)
        if (response && response.rows !== undefined) {
          state.filteredData = response.rows;
          state.totalItems = response.total;

          // BUGFIX: Jika halaman saat ini kosong karena penghapusan data, 
          // pindah ke halaman sebelumnya yang valid.
          const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
          if (state.currentPage > totalPages && totalPages > 0) {
            state.currentPage = totalPages;
            return refreshData(); // Fetch ulang untuk halaman yang benar
          }
        } else {
          state.filteredData = Array.isArray(response) ? response : [];
          state.totalItems = state.filteredData.length;
        }
      } catch (err) {
        console.error('Table fetch error:', err);
        state.filteredData = [];
        state.totalItems = 0;
      }

      renderRows();
      renderPagination();

      // Sync selection state to custom UI (like Bulk Delete button)
      if (options.selectable) {
        document.dispatchEvent(new CustomEvent('table:selectionChange', { detail: Array.from(state.selectedIds) }));
      }

      // Signal that data has been loaded (useful for syncing external buttons)
      document.dispatchEvent(new CustomEvent('table:dataLoaded', { detail: response }));
    };

    // Initial load
    renderLayout();
    await refreshData();

    // Auto reload event
    const handleReload = async () => {
      if (!document.body.contains(el)) {
        document.removeEventListener('table:reload', handleReload);
        return;
      }
      state.selectedIds.clear();
      document.dispatchEvent(new CustomEvent('table:selectionChange', { detail: [] }));
      await refreshData();
    };
    document.addEventListener('table:reload', handleReload);

    return {
      refresh: refreshData,
      getSelectedIds: () => Array.from(state.selectedIds)
    };
  }
};

export default Table;

