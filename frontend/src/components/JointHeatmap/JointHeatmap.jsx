import React, { useState } from 'react';
import './JointHeatmap.css';

const JOINTS = ['Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3'];

export default function JointHeatmap() {
  const [hoveredCell, setHoveredCell] = useState(null);

  // Generate 24 hours x 6 joints matrix
  const matrix = JOINTS.map((jointName, jIdx) => {
    return Array.from({ length: 24 }, (_, i) => {
      const hour = 23 - i; // 23h ago to now
      let status = 'ok';
      let torque = (jIdx < 3 ? 45 : 10) + Math.sin(i * 0.4 + jIdx) * 6;

      // Realistic historical anomalies
      if (jIdx === 2 && (hour === 2 || hour === 3)) {
        status = 'critical';
        torque = 185.2;
      } else if (jIdx === 1 && hour === 11) {
        status = 'warn';
        torque = 78.4;
      } else if (jIdx === 4 && hour === 22) {
        status = 'warn';
        torque = 16.8;
      }

      return {
        joint: jointName,
        jointIndex: jIdx,
        hour,
        timeLabel: hour === 0 ? 'Now' : `${hour}h ago`,
        status,
        torque,
      };
    }).reverse();
  });

  return (
    <div className="joint-heatmap glass glass-sheen">
      <div className="heatmap-header">
        <div>
          <span className="heatmap-title">24-Hour 6-DOF Telemetry Matrix</span>
          <span className="heatmap-sub">Joint health heatmap across 24 hourly operating buckets</span>
        </div>
        <div className="heatmap-legend">
          <span className="legend-item"><span className="legend-dot dot-ok" /> Normal</span>
          <span className="legend-item"><span className="legend-dot dot-warn" /> Attention</span>
          <span className="legend-item"><span className="legend-dot dot-crit" /> Anomaly</span>
        </div>
      </div>

      <div className="heatmap-grid-container">
        {matrix.map((row, rIdx) => (
          <div key={rIdx} className="heatmap-row">
            <span className="heatmap-row-label font-mono">J{rIdx + 1}</span>
            <div className="heatmap-cells">
              {row.map((cell, cIdx) => (
                <div
                  key={cIdx}
                  className={`heatmap-cell cell--${cell.status}`}
                  style={{ animationDelay: `${(rIdx + cIdx) * 15}ms` }}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {hoveredCell ? (
        <div className="heatmap-tooltip-banner font-mono">
          <span className="tooltip-joint">{hoveredCell.joint}</span>
          <span className="tooltip-sep">·</span>
          <span>{hoveredCell.timeLabel}</span>
          <span className="tooltip-sep">·</span>
          <span>{hoveredCell.torque.toFixed(1)} Nm ({hoveredCell.status === 'critical' ? 'Over-torque Anomaly' : hoveredCell.status === 'warn' ? 'Elevated Strain' : 'Nominal Safe'})</span>
        </div>
      ) : (
        <div className="heatmap-time-axis font-mono">
          <span>24h ago</span>
          <span>18h ago</span>
          <span>12h ago</span>
          <span>6h ago</span>
          <span>Now</span>
        </div>
      )}
    </div>
  );
}
