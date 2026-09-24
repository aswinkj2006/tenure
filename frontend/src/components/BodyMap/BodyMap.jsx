import React from 'react';
import useSensorStore from '../../stores/sensorStore';
import './BodyMap.css';

const JOINTS = [
  { id: 0, name: 'Base', x: 50, y: 155, r: 8 },
  { id: 1, name: 'Shoulder', x: 50, y: 120, r: 8 },
  { id: 2, name: 'Elbow', x: 100, y: 55, r: 8 },
  { id: 3, name: 'Wrist 1', x: 155, y: 75, r: 7 },
  { id: 4, name: 'Wrist 2', x: 175, y: 95, r: 6 },
  { id: 5, name: 'Wrist 3', x: 195, y: 110, r: 6 },
];

export default function BodyMap() {
  const joints = useSensorStore((s) => s.joints);
  const anomalyJoint = useSensorStore((s) => s.anomalyJoint);
  const hoveredJoint = useSensorStore((s) => s.hoveredJoint);
  const selectedJoint = useSensorStore((s) => s.selectedJoint);
  const setHoveredJoint = useSensorStore((s) => s.setHoveredJoint);
  const setSelectedJoint = useSensorStore((s) => s.setSelectedJoint);

  return (
    <div className="bodymap-container">
      <div className="bodymap-header">
        <span className="bodymap-title">Kinematic Body Map</span>
        <span className="bodymap-subtitle">Interactive 6-DOF overview</span>
      </div>

      <div className="bodymap-svg-wrapper">
        <svg viewBox="0 0 240 180" className="bodymap-svg">
          {/* Base mounting platform */}
          <rect x="25" y="160" width="50" height="8" rx="3" fill="#D5CEC5" />
          
          {/* Kinematic Link lines */}
          <path
            d="M 50 155 L 50 120 L 100 55 L 155 75 L 175 95 L 195 110"
            fill="none"
            stroke="#D0C7BC"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Gripper Tool at TCP */}
          <path
            d="M 195 110 L 210 120 M 205 114 L 214 110 M 208 126 L 218 122"
            fill="none"
            stroke="#8A8178"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Joint Nodes */}
          {JOINTS.map((j) => {
            const jointData = joints[j.id] || {};
            const isAnomaly = anomalyJoint === j.id;
            const isHovered = hoveredJoint === j.id || selectedJoint === j.id;
            const status = isAnomaly ? 'critical' : jointData.status || 'ok';

            let nodeFill = '#5E8C61'; // sage
            if (status === 'critical') nodeFill = '#C05646'; // brick
            else if (status === 'warn') nodeFill = '#D49B35'; // ochre

            return (
              <g
                key={j.id}
                className={`bodymap-joint-node ${isHovered ? 'active' : ''} ${isAnomaly ? 'pulse-danger' : ''}`}
                onMouseEnter={() => setHoveredJoint(j.id)}
                onMouseLeave={() => setHoveredJoint(null)}
                onClick={() => setSelectedJoint(j.id)}
              >
                {/* Glow ring on hover / anomaly */}
                {(isHovered || isAnomaly) && (
                  <circle
                    cx={j.x}
                    cy={j.y}
                    r={j.r + 5}
                    fill="none"
                    stroke={isAnomaly ? '#C05646' : '#D97757'}
                    strokeWidth="2"
                    opacity={0.7}
                  />
                )}
                <circle
                  cx={j.x}
                  cy={j.y}
                  r={j.r}
                  fill={nodeFill}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                {/* Label text */}
                <text
                  x={j.x}
                  y={j.y - 12}
                  textAnchor="middle"
                  className="bodymap-joint-label font-mono"
                >
                  J{j.id + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
