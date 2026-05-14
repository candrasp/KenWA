/**
 * Dashboard page — status WA + statistik ringkas.
 */

import { WaAPI, ContactAPI, BlastAPI, ActivityAPI } from '../services/api.js';

const Dashboard = {
  activityInterval: null,
  chart: null,

  async mount(container) {
    // 1. Load Chart.js if not already loaded
    if (!window.Chart) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'js/lib/chart.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
      </div>
      <div class="stats-grid" id="stats-grid">
        <!-- Jumlah Kontak -->
        <div class="stat-card">
          <div class="stat-icon" style="color: var(--info); background: rgba(59, 130, 246, 0.1);">
            <i class='bx bx-group'></i>
          </div>
          <div>
            <p class="stat-label">Jumlah Kontak</p>
            <p class="stat-value" id="total-contacts">—</p>
          </div>
        </div>

        <!-- Pesan Terkirim -->
        <div class="stat-card">
          <div class="stat-icon" style="color: var(--success); background: rgba(76, 175, 130, 0.1);">
            <i class='bx bx-check-double'></i>
          </div>
          <div>
            <p class="stat-label">Pesan Terkirim</p>
            <p class="stat-value" id="total-sent">—</p>
          </div>
        </div>

        <!-- Pesan Gagal -->
        <div class="stat-card">
          <div class="stat-icon" style="color: var(--danger); background: rgba(224, 92, 92, 0.1);">
            <i class='bx bx-error-circle'></i>
          </div>
          <div>
            <p class="stat-label">Pesan Gagal</p>
            <p class="stat-value" id="total-failed">—</p>
          </div>
        </div>
      </div>

      <div class="dashboard-content" style="display: flex; gap: 24px; margin-top: 24px; min-height: 400px;">
        <!-- Left Side (Grafik Statistik) -->
        <div style="flex: 2; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-primary); padding: 20px; display: flex; flex-direction: column;">
          <div style="font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
            <i class='bx bx-bar-chart-alt-2' style="color: var(--primary);"></i>
            Statistik Pengiriman (7 Hari Terakhir)
          </div>
          <div style="flex: 1; min-height: 250px; position: relative;">
            <canvas id="blast-stats-chart"></canvas>
          </div>
        </div>
        
        <!-- Right Side (Aktivitas Terakhir) -->
        <div style="flex: 1; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-primary); display: flex; flex-direction: column;">
          <!-- Header -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border); font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <i class='bx bx-pulse' style="color: var(--text-secondary);"></i>
            Aktivitas Terakhir
          </div>
          <!-- List / Feed -->
          <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;" id="recent-activity-list">
            <div class="text-center text-muted" style="font-size: 0.875rem;"><i class='bx bx-loader-alt bx-spin'></i> Memuat aktivitas...</div>
          </div>
        </div>
      </div>
    `;

    try {
      // Fetch data dashboard secara paralel
      const [contacts, history, statsData] = await Promise.all([
        ContactAPI.list({ limit: 1 }),
        BlastAPI.history({ limit: 1 }),
        BlastAPI.stats(),
      ]);

      document.getElementById('total-contacts').textContent = contacts.total || 0;
      document.getElementById('total-sent').textContent = history.totalSent || 0;
      document.getElementById('total-failed').textContent = history.totalFailed || 0;

      this.initChart(statsData);
      await this.loadActivity();
      
      if (this.activityInterval) clearInterval(this.activityInterval);
      this.activityInterval = setInterval(() => this.loadActivity(), 10000);
      
      container.addEventListener('unmount', () => {
        if (this.activityInterval) clearInterval(this.activityInterval);
        if (this.chart) this.chart.destroy();
      }, { once: true });
    } catch (err) {
      console.error('[Dashboard]', err);
    }
  },

  initChart(data) {
    const ctx = document.getElementById('blast-stats-chart').getContext('2d');
    
    // Generate label 7 hari terakhir jika data kosong
    const labels = [];
    const sentData = [];
    const failedData = [];

    // Map data dari backend ke struktur chart
    // Backend mengembalikan array of { date, sent, failed }
    // Kita perlu memastikan ada 7 titik data
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    last7Days.forEach(dateStr => {
      const found = data.find(d => d.date === dateStr);
      const d = new Date(dateStr);
      labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
      sentData.push(found ? found.sent : 0);
      failedData.push(found ? found.failed : 0);
    });

    if (this.chart) this.chart.destroy();
    const dimColor = '#606060'; // Sesuai --text-dim di variables.css

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Berhasil',
            data: sentData,
            borderColor: '#4caf82',
            backgroundColor: 'rgba(76, 175, 130, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#4caf82'
          },
          {
            label: 'Gagal',
            data: failedData,
            borderColor: '#e05c5c',
            backgroundColor: 'rgba(224, 92, 92, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#e05c5c'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
              color: dimColor,
              font: { family: "'Inter', sans-serif", size: 12 }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            padding: 12,
            backgroundColor: 'rgba(34, 34, 34, 0.95)',
            titleColor: '#ececec',
            bodyColor: '#a0a0a0',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleFont: { size: 14, weight: '600' },
            bodyFont: { size: 13 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { 
              stepSize: 1,
              color: dimColor,
              font: { family: "'Inter', sans-serif" }
            }
          },
          x: {
            grid: { display: false },
            ticks: { 
              color: dimColor,
              font: { family: "'Inter', sans-serif" }
            }
          }
        }
      }
    });
  },

  async loadActivity() {
    try {
      const res = await ActivityAPI.list({ limit: 6 });
      const listEl = document.getElementById('recent-activity-list');
      if (!listEl) return;
      
      if (!res.rows || res.rows.length === 0) {
        listEl.innerHTML = '<div class="text-center text-muted" style="font-size: 0.875rem;">Belum ada aktivitas</div>';
        return;
      }
      
      listEl.innerHTML = res.rows.map(activity => {
        let icon = 'bx-pulse';
        let color = 'var(--text-secondary)';
        
        switch (activity.type) {
          case 'contact':
          case 'import':
            icon = 'bx-user-plus'; color = 'var(--success)'; break;
          case 'sync':
            icon = 'bx-sync'; color = 'var(--info)'; break;
          case 'tag':
            icon = 'bx-tag'; color = 'var(--warning)'; break;
          case 'template':
            icon = 'bx-file'; color = 'var(--warning)'; break;
          case 'blast':
            icon = 'bx-send'; color = 'var(--primary)'; break;
          case 'login':
            icon = 'bx-log-in-circle'; color = 'var(--success)'; break;
        }
        
        const d = new Date(activity.created_at);
        const today = new Date();
        const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateStr = isToday ? 'Hari ini' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        
        return `
          <div style="display: flex; gap: 12px; align-items: flex-start; font-size: 0.875rem;">
            <i class='bx ${icon}' style="color: ${color}; margin-top: 2px;"></i>
            <div style="color: var(--text-secondary); line-height: 1.4;">
              ${activity.message}
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                ${dateStr}, ${timeStr}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('[Dashboard] Gagal memuat aktivitas', err);
    }
  }
};

export default Dashboard;
