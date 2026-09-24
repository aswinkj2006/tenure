import { useState } from 'react';
import StatusDot from '../common/StatusDot';
import Sparkline from './Sparkline';
import { formatValue, JOINT_NAMES } from '../../utils/format';
import useSensorStore from '../../stores/sensorStore';
import './SensorCard.css';

/**
 * Joint sensor card — shows torque as hero, sparkline, expandable position/velocity,
 * and highlights when linked with 3D twin or body map.
 */
export function JointCard({ jointKey, data, history = [] }) {
  const [expanded, setExpanded] = useState(false);
  const joint = JOINT_NAMES[jointKey];
  
  // Extract 0-based joint index (e.g., joint_1 -> 0)
  const jointIdx = jointKey ? parseInt(jointKey.replace('joint_', ''), 10) - 1 : null;
  const hoveredJoint = useSensorStore((s) => s.hoveredJoint);
  const selectedJoint = useSensorStore((s) => s.selectedJoint);
  const anomalyJoint = useSensorStore((s) => s.anomalyJoint);
  const setHoveredJoint = useSensorStore((s) => s.setHoveredJoint);
  const setSelectedJoint = useSensorStore((s) => s.setSelectedJoint);

  if (!joint || !data) return null;

  const isAnomalous = anomalyJoint === jointIdx;
  const isHighlighted = hoveredJoint === jointIdx || selectedJoint === jointIdx;
  const status = isAnomalous ? 'critical' : data.status === 'critical' ? 'critical' : data.status === 'warn' ? 'warn' : 'ok';
  const statusLabel = status === 'ok' ? 'Working normally' : status === 'warn' ? 'Needs attention' : 'Needs action now';

  const sparkColor = status === 'critical' ? 'var(--critical, #C05646)' : status === 'warn' ? 'var(--warn, #D49B35)' : 'var(--terracotta, #D97757)';

  return (
    <div
      className={`sensor-card sensor-card--${status} ${expanded ? 'sensor-card--expanded' : ''} ${isHighlighted ? 'sensor-card--highlighted' : ''}`}
      onClick={() => {
        setExpanded(!expanded);
        if (jointIdx !== null) setSelectedJoint(jointIdx);
      }}
      onMouseEnter={() => {
        if (jointIdx !== null) setHoveredJoint(jointIdx);
      }}
      onMouseLeave={() => {
        if (jointIdx !== null) setHoveredJoint(null);
      }}
      role="button"
      tabIndex={0}
      aria-label={`${joint.friendly} joint sensor card`}
    >
      {/* Header */}
      <div className="sensor-card__header">
        <div>
          <div className="sensor-card__name">{joint.friendly}</div>
          <div className="sensor-card__label">{joint.short} · Torque</div>
        </div>
        <div className="sensor-card__status">
          <StatusDot status={status} pulse={status === 'critical'} />
          {statusLabel}
        </div>
      </div>

      {/* Hero value */}
      <div className="sensor-card__value-row">
        <span className={`sensor-card__value ${status !== 'ok' ? `sensor-card__value--${status}` : ''}`}>
          {formatValue(data.torque)}
        </span>
        <span className="sensor-card__unit">Nm</span>
      </div>

      {/* Sparkline */}
      <div className="sensor-card__sparkline">
        <Sparkline data={history} color={sparkColor} />
      </div>

      {/* Expandable details */}
      <div className="sensor-card__details">
        <div className="sensor-card__detail">
          <span className="sensor-card__detail-label">Position</span>
          <span className="sensor-card__detail-value">{formatValue(data.position, 3)} rad</span>
        </div>
        <div className="sensor-card__detail">
          <span className="sensor-card__detail-label">Velocity</span>
          <span className="sensor-card__detail-value">{formatValue(data.velocity, 3)} rad/s</span>
        </div>
      </div>
    </div>
  );
}

/**
 * TCP (Tool Center Point) card — shows x, y, z coordinates.
 */
export function TCPCard({ data }) {
  if (!data) return null;

  return (
    <div className="sensor-card sensor-card--ok sensor-card--tcp">
      <div className="sensor-card__header">
        <div>
          <div className="sensor-card__name">Tool Position</div>
          <div className="sensor-card__label">TCP · Cartesian</div>
        </div>
        <div className="sensor-card__status">
          <StatusDot status="ok" />
          Working normally
        </div>
      </div>

      <div className="sensor-card__tcp-grid">
        <div className="sensor-card__tcp-axis">
          <span className="sensor-card__tcp-label">X</span>
          <span className="sensor-card__tcp-value">{formatValue(data.x, 3)}</span>
        </div>
        <div className="sensor-card__tcp-axis">
          <span className="sensor-card__tcp-label">Y</span>
          <span className="sensor-card__tcp-value">{formatValue(data.y, 3)}</span>
        </div>
        <div className="sensor-card__tcp-axis">
          <span className="sensor-card__tcp-label">Z</span>
          <span className="sensor-card__tcp-value">{formatValue(data.z, 3)}</span>
        </div>
      </div>
    </div>
  );
}
