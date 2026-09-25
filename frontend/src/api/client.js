/**
 * Tenure — API Client
 * Centralized fetch wrapper. Connects to live backend with graceful mock fallback.
 */
import {
  MOCK_MACHINES,
  MOCK_DASHBOARD_SUMMARY,
  MOCK_ISSUES,
  MOCK_ISSUE_DETAIL,
  MOCK_CHAT_RESPONSES,
} from './mocks';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCKS = false; // Primary live backend mode

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 6000);
  
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ── Machines ──

export async function getMachines() {
  if (!USE_MOCKS) {
    try {
      const data = await request('/machines');
      if (Array.isArray(data)) return { machines: data };
      if (data && data.machines) return data;
      return { machines: data || [] };
    } catch (err) {
      console.warn('[API] /machines fallback to mock:', err.message);
    }
  }
  return { machines: MOCK_MACHINES };
}

export async function getMachine(machineId) {
  if (!USE_MOCKS) {
    try {
      const data = await request(`/machines/${machineId}`);
      if (data) return data;
    } catch (err) {
      console.warn(`[API] /machines/${machineId} fallback to mock:`, err.message);
    }
  }
  const machine = MOCK_MACHINES.find((m) => m.machine_id === machineId) || MOCK_MACHINES[0];
  return machine;
}

export async function onboardMachine(payload) {
  if (!USE_MOCKS) {
    try {
      const data = await request('/api/machines/onboard', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data;
    } catch (err) {
      console.warn('[API] /machines/onboard fallback to local ok:', err.message);
    }
  }
  return { status: 'created', ...payload };
}

// ── Chat ──

let chatResponseIdx = 0;

export async function sendChat({ machine_id, message, anomaly_id }) {
  if (!USE_MOCKS) {
    try {
      const data = await request('/chat', {
        method: 'POST',
        body: JSON.stringify({ machine_id, message, anomaly_id }),
      });
      return data;
    } catch (err) {
      console.warn('[API] /chat fallback to mock:', err.message);
    }
  }
  const resp = MOCK_CHAT_RESPONSES[chatResponseIdx % MOCK_CHAT_RESPONSES.length];
  chatResponseIdx++;
  return { ...resp, anomaly_id: anomaly_id || null };
}

// ── Diagnose ──

export async function diagnoseAnomaly(anomalyId) {
  if (!USE_MOCKS) {
    try {
      const data = await request('/diagnose', {
        method: 'POST',
        body: JSON.stringify({ anomaly_id: anomalyId }),
      });
      return data;
    } catch (err) {
      console.warn('[API] /diagnose fallback to mock:', err.message);
    }
  }
  return {
    diagnosis_id: 'diag-mock-001',
    anomaly_id: anomalyId,
    diagnosis: "The elbow joint torque spike of 185 Nm exceeds the UR5e's rated maximum of 150 Nm. Most likely caused by a physical collision or unexpected payload change.",
    citations: MOCK_CHAT_RESPONSES[0].citations,
    confidence: 0.87,
    severity: 'critical',
  };
}

// ── Feedback ──

export async function sendFeedback({ diagnosis_id, outcome, confirmed_cause }) {
  if (!USE_MOCKS) {
    try {
      const data = await request('/feedback', {
        method: 'POST',
        body: JSON.stringify({ diagnosis_id, outcome, confirmed_cause }),
      });
      return data;
    } catch (err) {
      console.warn('[API] /feedback fallback to mock:', err.message);
    }
  }
  return { status: 'ok', feedback_id: 'fb-mock-001' };
}

// ── Logs ──

export async function getLogs(filters = {}) {
  if (!USE_MOCKS) {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const data = await request(`/logs?${params.toString()}`);
      if (data && data.issues) return data;
    } catch (err) {
      console.warn('[API] /logs fallback to mock:', err.message);
    }
  }

  let issues = [...MOCK_ISSUES];
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

export async function getLogDetail(anomalyId) {
  if (!USE_MOCKS) {
    try {
      const data = await request(`/logs/${anomalyId}`);
      if (data) return data;
    } catch (err) {
      console.warn(`[API] /logs/${anomalyId} fallback to mock:`, err.message);
    }
  }
  if (anomalyId === 'anom-001') return MOCK_ISSUE_DETAIL;
  const issue = MOCK_ISSUES.find((i) => i.anomaly_id === anomalyId);
  if (!issue) return MOCK_ISSUE_DETAIL;
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

// ── Dashboard ──

export async function getDashboardSummary() {
  if (!USE_MOCKS) {
    try {
      const data = await request('/dashboard/summary');
      if (data) return data;
    } catch (err) {
      console.warn('[API] /dashboard/summary fallback to mock:', err.message);
    }
  }
  return MOCK_DASHBOARD_SUMMARY;
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
