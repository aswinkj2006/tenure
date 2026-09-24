import { useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Pin, PinOff } from 'lucide-react';
import { format } from 'date-fns';
import './DynamicChart.css';

function formatAxisTick(value) {
  try {
    return format(new Date(value), 'HH:mm');
  } catch {
    return value;
  }
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dynamic-chart-tooltip glass-strong font-body">
      <div className="chart-tooltip-time font-mono">
        {formatAxisTick(label)}
      </div>
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="tooltip-legend-dot" style={{ backgroundColor: entry.color || 'var(--terracotta, #B8723B)' }} />
          <span className="tooltip-entry-name">{entry.name}:</span>
          <span className="tooltip-entry-val font-mono">
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value} Nm
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DynamicChart({ chartData, onTogglePin }) {
  const [pinned, setPinned] = useState(chartData?.pin_to_dashboard || false);

  if (!chartData) return null;

  const { chart_type, title, x_label, y_label, series } = chartData;

  // Flatten series data for Recharts
  const flatData = series?.[0]?.data?.map((point) => {
    const entry = { x: point.x };
    series.forEach((s) => {
      const match = s.data.find((d) => d.x === point.x);
      entry[s.name] = match?.y;
    });
    return entry;
  }) || [];

  const handlePin = () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    onTogglePin?.(chartData, newPinned);
  };

  const chartColor = '#B8723B'; // terracotta

  return (
    <div className="dynamic-chart glass glass-sheen">
      <div className="dynamic-chart__header">
        <span className="dynamic-chart__title">{title}</span>
        <button
          type="button"
          className={`dynamic-chart__pin glass-subtle ${pinned ? 'dynamic-chart__pin--pinned' : ''}`}
          onClick={handlePin}
        >
          {pinned ? <PinOff size={12} strokeWidth={1.5} /> : <Pin size={12} strokeWidth={1.5} />}
          {pinned ? 'Unpin' : 'Pin'}
        </button>
      </div>

      <div className="dynamic-chart__body">
        <ResponsiveContainer width="100%" height="100%">
          {chart_type === 'bar' ? (
            <BarChart data={flatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 205, 178, 0.4)" vertical={false} />
              <XAxis dataKey="x" tickFormatter={formatAxisTick} tick={{ fontSize: 11, fill: '#A8967F' }} axisLine={{ stroke: 'rgba(226, 205, 178, 0.5)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#A8967F' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(184, 114, 59, 0.2)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
              {series.map((s, i) => (
                <Bar key={i} dataKey={s.name} fill={chartColor} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : chart_type === 'area' ? (
            <AreaChart data={flatData}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B8723B" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="#E2CDB2" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#F6EEE0" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 205, 178, 0.4)" vertical={false} />
              <XAxis dataKey="x" tickFormatter={formatAxisTick} tick={{ fontSize: 11, fill: '#A8967F' }} axisLine={{ stroke: 'rgba(226, 205, 178, 0.5)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#A8967F' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(184, 114, 59, 0.25)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
              <ReferenceLine y={150} label={{ value: 'Rated Limit (150 Nm)', position: 'insideTopRight', fill: '#B23A2E', fontSize: 10 }} stroke="#B23A2E" strokeDasharray="4 4" opacity={0.6} />
              {series.map((s, i) => (
                <Area
                  key={i}
                  type="monotone"
                  dataKey={s.name}
                  stroke={chartColor}
                  strokeWidth={2.5}
                  fill="url(#chartGradient)"
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={flatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 205, 178, 0.4)" vertical={false} />
              <XAxis dataKey="x" tickFormatter={formatAxisTick} tick={{ fontSize: 11, fill: '#A8967F' }} axisLine={{ stroke: 'rgba(226, 205, 178, 0.5)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#A8967F' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(184, 114, 59, 0.25)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
              {series.map((s, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={s.name}
                  stroke={chartColor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: chartColor, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
