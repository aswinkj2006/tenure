import React from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  ChevronRight, 
  Activity,
  Flame,
  Zap,
  Wrench,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { relativeTime } from '../../utils/format';
import './IssueRow.css';

export default function IssueRow({ issue, onClick }) {
  const isCritical = issue.severity === 'critical';
  const isHigh = issue.severity === 'high';
  const isMedium = issue.severity === 'medium';
  const isLow = issue.severity === 'low';

  const isResolved = issue.status === 'resolved';
  const isConfirmed = issue.outcome === 'confirmed';

  // Format short incident code
  const incidentCode = issue.anomaly_id?.startsWith('inc-')
    ? issue.anomaly_id.toUpperCase()
    : `INC-${issue.anomaly_id?.slice(0, 8).toUpperCase()}`;

  // Format sensor display
  const sensors = issue.flagged_sensors || [];

  return (
    <div
      className={`issue-row-pro glass glass-sheen severity--${issue.severity}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click to view full root-cause analysis and citations"
    >
      {/* Left Vertical Severity Accent Bar */}
      <div className={`issue-row-pro__accent severity-bar--${issue.severity}`} />

      {/* Main Body */}
      <div className="issue-row-pro__body">
        {/* Top Meta Line: Code, Severity Tag, Machine, Timestamp */}
        <div className="issue-row-pro__header">
          <div className="issue-row-pro__identifiers">
            <span className="issue-row-pro__code font-mono">
              {incidentCode}
            </span>

            <span className={`issue-row-pro__sev-badge sev-badge--${issue.severity}`}>
              {isCritical && <AlertTriangle size={12} />}
              {isHigh && <ShieldAlert size={12} />}
              {isMedium && <Activity size={12} />}
              {isLow && <AlertCircle size={12} />}
              <span>{issue.severity?.toUpperCase()}</span>
            </span>

            <span className="issue-row-pro__machine-tag">
              <Cpu size={13} className="text-terracotta" />
              <span>{issue.machine_name || issue.machine_id}</span>
            </span>
          </div>

          <div className="issue-row-pro__timestamp font-mono">
            <Clock size={12} />
            <span>{relativeTime(issue.timestamp || issue.ts)}</span>
          </div>
        </div>

        {/* Middle Line: Diagnosis Title */}
        <div className="issue-row-pro__title-row">
          <h4 className="issue-row-pro__title">
            {issue.diagnosis_summary || 'Mechanical anomaly detected during autonomous monitoring cycle.'}
          </h4>
        </div>

        {/* Bottom Line: Flagged Sensor Pills + Resolution Status Pill */}
        <div className="issue-row-pro__footer">
          <div className="issue-row-pro__sensors">
            {sensors.map((sensor, idx) => {
              const cleanName = sensor.replace(/_/g, ' ');
              const deviation = issue.deviation_magnitude?.[sensor];
              const isThermal = sensor.includes('temp');
              const isTorque = sensor.includes('torque');

              return (
                <span key={idx} className="issue-row-pro__sensor-pill font-mono">
                  {isTorque ? <Zap size={11} className="text-rust" /> : isThermal ? <Flame size={11} className="text-brick" /> : <Activity size={11} className="text-terracotta" />}
                  <span>{cleanName}</span>
                  {deviation !== undefined && (
                    <strong className="issue-row-pro__dev-val">
                      +{deviation}{sensor.includes('torque') ? ' Nm' : sensor.includes('temp') ? '°C' : ''}
                    </strong>
                  )}
                </span>
              );
            })}
          </div>

          <div className="issue-row-pro__status-wrap">
            {isResolved ? (
              <span className="issue-row-pro__status-pill status-pill--resolved">
                <ShieldCheck size={13} />
                <span>{isConfirmed ? 'Verified & Rewarded' : 'Resolved'}</span>
              </span>
            ) : (
              <span className="issue-row-pro__status-pill status-pill--open">
                <span className="issue-row-pro__pulsing-dot" />
                <span>Active E-Stop / Open</span>
              </span>
            )}

            <div className="issue-row-pro__action-hint">
              <span>Audit Details</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
