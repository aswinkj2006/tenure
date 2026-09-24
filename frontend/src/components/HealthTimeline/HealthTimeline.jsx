import React, { useState } from 'react';
import './HealthTimeline.css';

export default function HealthTimeline() {
  const [activeTooltip, setActiveTooltip] = useState(null);

  // 24 hours of blocks
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = 23 - i; // 23h ago to now
    let status = 'healthy';
    let label = 'Normal operation (100% health)';

    if (h === 2) {
      status = 'critical';
      label = '2.5h ago: Elbow torque anomaly (185 Nm)';
    } else if (h === 6) {
      status = 'warning';
      label = '6h ago: TCP trajectory calibration drift';
    } else if (h === 11) {
      status = 'warning';
      label = '11h ago: Elevated shoulder torque during lift';
    }

    return {
      hour: h,
      timeLabel: h === 0 ? 'Now' : `${h}h ago`,
      status,
      label,
    };
  }).reverse();

  return (
    <div className="health-timeline-container">
      <div className="health-timeline-header">
        <span className="health-timeline-title">24-Hour Operating Health</span>
        <span className="health-timeline-meta font-mono">94.2% Uptime</span>
      </div>

      <div className="health-timeline-bar">
        {hours.map((item, idx) => (
          <div
            key={idx}
            className={`timeline-segment segment-${item.status}`}
            onMouseEnter={() => setActiveTooltip(item)}
            onMouseLeave={() => setActiveTooltip(null)}
          />
        ))}
      </div>

      {activeTooltip ? (
        <div className="timeline-tooltip-active font-mono">
          <span className="tooltip-time">{activeTooltip.timeLabel}:</span> {activeTooltip.label}
        </div>
      ) : (
        <div className="health-timeline-footer font-mono">
          <span>24h ago</span>
          <span>12h ago</span>
          <span>Now</span>
        </div>
      )}
    </div>
  );
}
