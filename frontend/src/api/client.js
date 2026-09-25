/**
 * Tenure — API Client
 * Centralized fetch wrapper. Uses mock data in dev until backend is live.
 */
import {
  MOCK_MACHINES,
  MOCK_DASHBOARD_SUMMARY,
  MOCK_ISSUES,
  MOCK_ISSUE_DETAIL,
  MOCK_CHAT_RESPONSES,
} from './mocks';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCKS = true; // Toggle when backend is available

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Simulate network delay
function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Machines ──

export async function getMachines() {
  if (USE_MOCKS) {
    await delay();
    return { machines: MOCK_MACHINES };
  }
  return request('/machines');
}

export async function getMachine(machineId) {
  if (USE_MOCKS) {
    await delay();
    const machine = MOCK_MACHINES.find((m) => m.machine_id === machineId);
    if (!machine) throw new Error('Machine not found');
    return machine;
  }
  return request(`/machines/${machineId}`);
}

// ── Chat ──

let chatResponseIdx = 0;

export async function sendChat({ machine_id, message, anomaly_id }) {
  if (USE_MOCKS) {
    await delay(800);
    const resp = MOCK_CHAT_RESPONSES[chatResponseIdx % MOCK_CHAT_RESPONSES.length];
    chatResponseIdx++;
    return { ...resp, anomaly_id: anomaly_id || null };
  }
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ machine_id, message, anomaly_id }),
  });
}

// ── Diagnose ──

export async function diagnoseAnomaly(anomalyId) {
  if (USE_MOCKS) {
    await delay(1000);
    return {
      diagnosis_id: 'diag-mock-001',
      anomaly_id: anomalyId,
      diagnosis: 'The elbow joint torque spike of 185 Nm exceeds the UR5e\'s rated maximum of 150 Nm. Most likely caused by a physical collision or unexpected payload change.',
      citations: MOCK_CHAT_RESPONSES[0].citations,
      confidence: 0.87,
      severity: 'critical',
    };
  }
  return request('/diagnose', {
    method: 'POST',
    body: JSON.stringify({ anomaly_id: anomalyId }),
  });
}

// ── Feedback ──

export async function sendFeedback({ diagnosis_id, outcome, confirmed_cause }) {
  if (USE_MOCKS) {
    await delay(300);
    return { status: 'ok', feedback_id: 'fb-mock-001' };
  }
  return request('/feedback', {
    method: 'POST',
    body: JSON.stringify({ diagnosis_id, outcome, confirmed_cause }),
  });
}

// ── Logs ──

export async function getLogs(filters = {}) {
  if (USE_MOCKS) {
    await delay(500);
    let issues = [...MOCK_ISSUES];

    // Apply filters
    if (filters.machine_id) {
      issues = issues.filter((i) => i.machine_id === filters.machine_id);
    }
    if (filters.severity) {
      issues = issues.filter((i) => i.severity === filters.severity);
    }
    if (filters.status) {
      issues = issues.filter((i) => i.status === filters.status);
    }
    if (filters.outcome) {
      issues = issues.filter((i) => i.outcome === filters.outcome);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      issues = issues.filter(
        (i) =>
          i.diagnosis_summary.toLowerCase().includes(q) ||
          i.flagged_sensors.some((s) => s.toLowerCase().includes(q))
      );
    }

    return {
      total: issues.length,
      page: 1,
      per_page: 20,
      issues,
    };
  }

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return request(`/logs?${params.toString()}`);
}

export async function getLogDetail(anomalyId) {
  if (USE_MOCKS) {
    await delay(400);
    if (anomalyId === 'anom-001') return MOCK_ISSUE_DETAIL;
    // Return a modified version for other IDs
    const issue = MOCK_ISSUES.find((i) => i.anomaly_id === anomalyId);
    if (!issue) throw new Error('Issue not found');
    return {
      ...MOCK_ISSUE_DETAIL,
      ...issue,
      anomaly_data: {
        flagged_sensors: issue.flagged_sensors,
        deviation_magnitude: Object.fromEntries(issue.flagged_sensors.map((s) => [s, 1.5 + Math.random()])),
        sensor_values_at_flag: Object.fromEntries(issue.flagged_sensors.map((s) => [s, 50 + Math.random() * 100])),
      },
    };
  }
  return request(`/logs/${anomalyId}`);
}

// ── Dashboard ──

export async function getDashboardSummary() {
  if (USE_MOCKS) {
    await delay(300);
    return MOCK_DASHBOARD_SUMMARY;
  }
  return request('/dashboard/summary');
}

// ── Export helpers ──

export function getExportCsvUrl(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return `${API_BASE}/logs/export/csv?${params.toString()}`;
}

export function getExportPdfUrl(anomalyId) {
  return `${API_BASE}/logs/export/pdf/${anomalyId}`;
}
