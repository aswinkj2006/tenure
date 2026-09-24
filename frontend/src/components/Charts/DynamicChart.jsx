import { useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
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
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--blush)',
      borderRadius: 'var(--radius-inner)',
      padding: '8px 12px',
      boxShadow: 'var(--shadow-elevated)',
      fontSize: 'var(--text-sm)',
    }}>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginBottom: 4 }}>
        {formatAxisTick(label)}
      </div>
      {payload.map((entry, i) => (
        <div key={i} style={{ color: 'var(--charcoal)', fontFamily: 'var(--font-mono)' }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
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

  const chartColor = 'var(--terracotta)';

  return (
    <div className="dynamic-chart">
      <div className="dynamic-chart__header">
        <span className="dynamic-chart__title">{title}</span>
        <button
          className={`dynamic-chart__pin ${pinned ? 'dynamic-chart__pin--pinned' : ''}`}
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--blush)" vertical={false} />
              <XAxis dataKey="x" tickFormatter={formatAxisTick} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--blush)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              {series.map((s, i) => (
                <Bar key={i} dataKey={s.name} fill={chartColor} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : chart_type === 'area' ? (
            <AreaChart data={flatData}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--blush)" vertical={false} />
              <XAxis dataKey="x" tickFormatter={formatAxisTick} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--blush)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              {series.map((s, i) => (
                <Area key={i} type="monotone" dataKey={s.name} stroke={chartColor} strokeWidth={2} fill="url(#chartGradient)" />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={flatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--blush)" vertical={false} />
              <XAxis dataKey="x" tickFormatter={formatAxisTick} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={{ stroke: 'var(--blush)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              {series.map((s, i) => (
                <Line key={i} type="monotone" dataKey={s.name} stroke={chartColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: chartColor }} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
