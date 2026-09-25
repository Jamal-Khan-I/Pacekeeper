/**
 * API Service wrapper for Pacekeeper backend endpoints.
 * Updated for multi-class support (class_id parameter on topics, agents calls).
 */

const API_BASE = '/api';

async function fetchJSON(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // System Tier & Cloud Settings Info
  getTierInfo: () => fetchJSON('/system/tier-info'),
  getSystemSettings: () => fetchJSON('/system/settings'),
  updateSystemSettings: (settingsData) => fetchJSON('/system/settings', { method: 'POST', body: JSON.stringify(settingsData) }),
  testApiKey: (provider, apiKey, model) => fetchJSON('/system/test-key', { method: 'POST', body: JSON.stringify({ provider, api_key: apiKey, model }) }),

  // Classes Registry (Part B)
  getClasses: () => fetchJSON('/agents/classes'),

  // Topics CRUD — scoped by class_id
  getTopics: (classId = null) => fetchJSON(`/topics${classId ? `?class_id=${classId}` : ''}`),
  createTopic: (topicData) => fetchJSON('/topics', { method: 'POST', body: JSON.stringify(topicData) }),
  updateTopic: (id, topicData) => fetchJSON(`/topics/${id}`, { method: 'PUT', body: JSON.stringify(topicData) }),
  deleteTopic: (id) => fetchJSON(`/topics/${id}`, { method: 'DELETE' }),

  // Calendar
  getCalendar: () => fetchJSON('/calendar'),
  saveCalendarBulk: (days) => fetchJSON('/calendar/bulk', { method: 'POST', body: JSON.stringify({ days }) }),

  // Schedule
  getCurrentSchedule: (classId = 'class_a') => fetchJSON(`/schedule/current${classId ? `?class_id=${classId}` : ''}`),
  generateSchedule: (classId = 'class_a') => fetchJSON(`/schedule/generate${classId ? `?class_id=${classId}` : ''}`, { method: 'POST' }),
  exportScheduleICS: () => {
    window.location.href = `${API_BASE}/schedule/export-ics`;
  },
  triggerOSNotification: () => fetchJSON('/schedule/notify', { method: 'POST' }),

  // Performance Score Input & History
  submitPerformance: (perfData) => fetchJSON('/performance', { method: 'POST', body: JSON.stringify(perfData) }),
  getPerformanceRecords: (classId = null, source = null) => {
    const params = new URLSearchParams();
    if (classId) params.append('class_id', classId);
    if (source) params.append('source', source);
    const qs = params.toString();
    return fetchJSON(`/performance${qs ? `?${qs}` : ''}`);
  },
  resetLiveRecords: () => fetchJSON('/performance/reset-live', { method: 'POST' }),
  resetDemoRecords: () => fetchJSON('/performance/reset-demo', { method: 'POST' }),

  // Demo Data Seed (Part C)
  seedDemoData: () => fetchJSON('/agents/seed-demo-data', { method: 'POST' }),
  getDemoImages: (classId) => fetchJSON(`/agents/demo-images/${classId}`),

  // Ollama Status
  getOllamaStatus: () => fetchJSON('/agents/ollama-status'),

  // Teacher Copilot Interactive Agent
  copilotChat: (payload) => fetchJSON('/agents/copilot/chat', { method: 'POST', body: JSON.stringify(payload) }),
};
