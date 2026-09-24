import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { healthLabel, healthToStatus } from '../../utils/format';
import './HealthScore.css';

const STATUS_COLORS = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  critical: 'var(--critical)',
};

export default function HealthScore({ score = 0, size = 'default', showLabel = true }) {
  const status = healthToStatus(score);
  const color = STATUS_COLORS[status] || STATUS_COLORS.ok;
  const gaugeSize = size === 'sm' ? 80 : 120;

  const data = [
    { name: 'health', value: score, fill: color },
  ];

  return (
    <div className="health-score">
      <div className={`health-score__gauge ${size === 'sm' ? 'health-score__gauge--sm' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={size === 'sm' ? 6 : 8}
            data={data}
            startAngle={225}
            endAngle={-45}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={10}
              background={{ fill: 'var(--blush-light)' }}
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="health-score__value">{Math.round(score)}</div>
      </div>
      {showLabel && (
        <div className="health-score__label">{healthLabel(score)}</div>
      )}
    </div>
  );
}
