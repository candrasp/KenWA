/**
 * api.js — semua fetch ke Express server.
 * Base URL otomatis menunjuk ke http://127.0.0.1:3721
 */

const BASE = 'http://127.0.0.1:3721/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// ── WhatsApp ────────────────────────────────────────────────────────────────
export const WaAPI = {
  status:     ()       => request('GET',  '/wa'),
  connect:    ()       => request('POST', '/wa/connect'),
  disconnect: ()       => request('POST', '/wa/disconnect'),
};

// ── Contacts ────────────────────────────────────────────────────────────────
export const ContactAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/contacts${qs ? '?' + qs : ''}`);
  },
  checkExistence: (phone) => request('GET', `/contacts/check?phone=${encodeURIComponent(phone)}`),
  get:    (id)          => request('GET',    `/contacts/${id}`),
  create: (data)        => request('POST',   '/contacts', data),
  update: (id, data)    => request('PUT',    `/contacts/${id}`, data),
  delete: (id)          => request('DELETE', `/contacts/${id}`),
  bulkDelete: (ids)     => request('DELETE', '/contacts', { ids }),
  verify: (id)          => request('POST',   `/contacts/verify/${id}`),
  bulkAddTags: (ids, tags) => request('POST', '/contacts/bulk-tags', { ids, tags }),
  syncContacts: ()      => request('POST',   '/contacts/sync'),
};


// ── Tags ────────────────────────────────────────────────────────────────────
export const TagAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/tags${qs ? '?' + qs : ''}`);
  },
  get:    (id)          => request('GET',    `/tags/${id}`),
  create: (data)        => request('POST',   '/tags', data),
  update: (id, data)    => request('PUT',    `/tags/${id}`, data),
  delete: (id)          => request('DELETE', `/tags/${id}`),
  bulkDelete: (ids)     => request('DELETE', '/tags', { ids }),
};

// ── Blast ────────────────────────────────────────────────────────────────────
export const BlastAPI = {
  templates:      (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/blast/templates${qs ? '?' + qs : ''}`);
  },
  createTemplate: (data)   => request('POST',   '/blast/templates', data),
  updateTemplate: (id, d)  => request('PUT',    `/blast/templates/${id}`, d),
  deleteTemplate: (id)     => request('DELETE', `/blast/templates/${id}`),
  history:        (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/blast/history${qs ? '?' + qs : ''}`);
  },
  stats:          ()       => request('GET', '/blast/stats'),
  start:          (data)   => request('POST', '/blast/start', data),
};

// ── Settings ────────────────────────────────────────────────────────────────
export const SettingAPI = {
  get:    ()     => request('GET', '/settings'),
  update: (data) => request('PUT', '/settings', data),
};

export const AppConfig = {
  get:    ()     => request('GET', '/config'),
};

// ── Health ───────────────────────────────────────────────────────────────────
export const health = () => request('GET', '/health');

// ── Activity ─────────────────────────────────────────────────────────────────
export const ActivityAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/activity${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('POST', '/activity', data),
  clear:  ()     => request('DELETE', '/activity/clear'),
};
