import { formatDistanceToNow, format } from 'date-fns';

/**
 * Sensor-friendly name mapping for UR5e joints
 */
export const JOINT_NAMES = {
  joint_1: { friendly: 'Base', short: 'J1' },
  joint_2: { friendly: 'Shoulder', short: 'J2' },
  joint_3: { friendly: 'Elbow', short: 'J3' },
  joint_4: { friendly: 'Wrist 1', short: 'W1' },
  joint_5: { friendly: 'Wrist 2', short: 'W2' },
  joint_6: { friendly: 'Wrist 3', short: 'W3' },
};

/**
 * Map technical sensor name to friendly name
 * e.g. "joint_3_torque" → "Elbow"
 */
export function friendlyJointName(sensorKey) {
  const match = sensorKey.match(/^(joint_\d)/);
  if (match && JOINT_NAMES[match[1]]) {
    return JOINT_NAMES[match[1]].friendly;
  }
  if (sensorKey.startsWith('tcp_')) return 'Tool Position';
  return sensorKey;
}

/**
 * Map sensor status to friendly label
 */
export function friendlyStatus(status) {
  const map = {
    nominal: 'Working normally',
    normal: 'Working normally',
    warning: 'Needs attention',
    anomaly: 'Unusual activity',
    critical: 'Needs action now',
    online: 'Online',
    offline: 'Offline',
    ok: 'All clear',
    open: 'Open',
    resolved: 'Resolved',
  };
  return map[status] || status;
}

/**
 * Friendly severity label
 */
export function friendlySeverity(severity) {
  const map = {
    critical: 'Needs action now',
    high: 'High priority',
    medium: 'Worth watching',
    low: 'Minor note',
  };
  return map[severity] || severity;
}

/**
 * Format a number with fixed decimals
 */
export function formatValue(value, decimals = 1) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toFixed(decimals);
}

/**
 * Format relative time: "2h ago", "1d ago"
 */
export function relativeTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

/**
 * Format a full timestamp
 */
export function formatTimestamp(dateStr) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy · h:mm a');
  } catch {
    return dateStr;
  }
}

/**
 * Get severity-to-status-dot mapping
 */
export function severityToStatus(severity) {
  const map = {
    critical: 'critical',
    high: 'high',
    medium: 'warn',
    low: 'ok',
  };
  return map[severity] || 'ok';
}

/**
 * Map health score to status
 */
export function healthToStatus(score) {
  if (score >= 80) return 'ok';
  if (score >= 50) return 'warn';
  return 'critical';
}

/**
 * Get health label
 */
export function healthLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Needs attention';
  if (score >= 40) return 'Poor';
  return 'Critical';
}
