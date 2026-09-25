import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import StatusDot from '../common/StatusDot';
import Sparkline from './Sparkline';
import { JOINT_NAMES } from '../../utils/format';
import useSensorStore from '../../stores/sensorStore';
import './SensorCard.css';

// Rated torque maximums for UR5e joints (Nm)
const RATED_MAX_TORQUES = {
  joint_1: 150,
  joint_2: 150,
  joint_3: 150,
  joint_4: 28,
  joint_5: 28,
  joint_6: 28,
};

/**
 * Radial load ring showing current torque as % of rated maximum
 */
function LoadRing({ value, max = 150, status = 'ok' }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = 14;
  const stroke = 2.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  let strokeColor = '#5E8C61';
  if (status === 'critical') strokeColor = '#B23A2E';
  else if (status === 'warn') strokeColor = '#D9A441';

  return (
    <div className="sensor-load-ring" title={`${percent.toFixed(0)}% rated capacity (${value.toFixed(1)} / ${max} Nm)`}>
      <svg width="34" height="34" viewBox="0 0 34 34">
        {/* Background track */}
        <circle
          cx="17"
          cy="17"
          r={radius}
          fill="none"
          stroke="rgba(226, 205, 178, 0.4)"
          strokeWidth={stroke}
        />
        {/* Active progress arc */}
        <circle
          cx="17"
          cy="17"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 17 17)"
          style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
        />
      </svg>
      <span className="load-ring-percent font-mono">{percent.toFixed(0)}%</span>
    </div>
  );
}

/**
 * Joint sensor card — shows torque as hero, radial load ring, sparkline, and rolling digits.
 */
export function JointCard({ jointKey, data, history = [] }) {
  const [expanded, setExpanded] = useState(false);
  const joint = JOINT_NAMES[jointKey];
  
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
  const statusLabel = status === 'ok' ? 'Working normally' : status === 'warn' ? 'Needs attention' : 'Over-torque alert';

  const sparkColor = status === 'critical' ? 'var(--critical, #B23A2E)' : status === 'warn' ? 'var(--warn, #D9A441)' : 'var(--terracotta, #B8723B)';
  const maxRated = RATED_MAX_TORQUES[jointKey] || 150;

  return (
    <div
      className={`sensor-card glass glass-sheen sensor-card--${status} ${expanded ? 'sensor-card--expanded' : ''} ${isHighlighted ? 'sensor-card--highlighted' : ''} ${isAnomalous ? 'sensor-card--anomaly-shake' : ''}`}
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
          <div className="sensor-card__label font-mono">{joint.short} · Torque Load</div>
        </div>
        <div className="sensor-card__header-right">
          <LoadRing value={data.torque} max={maxRated} status={status} />
        </div>
      </div>

      {/* Hero value with NumberFlow */}
      <div className="sensor-card__value-row">
        <span className={`sensor-card__value font-mono ${status !== 'ok' ? `sensor-card__value--${status}` : ''}`}>
          <NumberFlow
            value={data.torque}
            format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
          />
        </span>
        <span className="sensor-card__unit font-mono">Nm</span>
        <div className="sensor-card__status-inline">
          <StatusDot status={status} pulse={status === 'critical'} />
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="sensor-card__sparkline">
        <Sparkline data={history} color={sparkColor} />
      </div>

      {/* Expandable kinematic details with NumberFlow */}
      <div className="sensor-card__details">
        <div className="sensor-card__detail">
          <span className="sensor-card__detail-label">Position</span>
          <span className="sensor-card__detail-value font-mono">
            <NumberFlow
              value={data.position}
              format={{ minimumFractionDigits: 3, maximumFractionDigits: 3 }}
            />{' '}
            rad
          </span>
        </div>
        <div className="sensor-card__detail">
          <span className="sensor-card__detail-label">Velocity</span>
          <span className="sensor-card__detail-value font-mono">
            <NumberFlow
              value={data.velocity}
              format={{ minimumFractionDigits: 3, maximumFractionDigits: 3 }}
            />{' '}
            rad/s
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * TCP (Tool Center Point) card — shows x, y, z coordinates with NumberFlow.
 */
export function TCPCard({ data }) {
  if (!data) return null;

  return (
    <div className="sensor-card glass glass-sheen sensor-card--ok sensor-card--tcp">
      <div className="sensor-card__header sensor-card__header--tcp">
        <div className="sensor-card__titles">
          <div className="sensor-card__name font-heading">Tool Position (TCP)</div>
          <div className="sensor-card__label font-mono">Cartesian [X, Y, Z] Coordinates</div>
        </div>
        <div className="sensor-card__status font-mono">
          <StatusDot status="ok" />
          <span>Active</span>
        </div>
      </div>

      <div className="sensor-card__tcp-grid">
        <div className="sensor-card__tcp-axis">
          <span className="sensor-card__tcp-label font-mono">X Axis</span>
          <span className="sensor-card__tcp-value font-mono">
            <NumberFlow
              value={data.x}
              format={{ minimumFractionDigits: 3, maximumFractionDigits: 3 }}
            />
          </span>
        </div>
        <div className="sensor-card__tcp-axis">
          <span className="sensor-card__tcp-label font-mono">Y Axis</span>
          <span className="sensor-card__tcp-value font-mono">
            <NumberFlow
              value={data.y}
              format={{ minimumFractionDigits: 3, maximumFractionDigits: 3 }}
            />
          </span>
        </div>
        <div className="sensor-card__tcp-axis">
          <span className="sensor-card__tcp-label font-mono">Z Axis</span>
          <span className="sensor-card__tcp-value font-mono">
            <NumberFlow
              value={data.z}
              format={{ minimumFractionDigits: 3, maximumFractionDigits: 3 }}
            />
          </span>
        </div>
      </div>
    </div>
  );

}
