import { AreaChart, Area, ResponsiveContainer } from 'recharts';

/**
 * Tiny sparkline chart for sensor cards.
 * Renders last ~30 data points as a smooth area fill.
 */
export default function Sparkline({ data = [], color = 'var(--terracotta)', height = 48 }) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((d, i) => ({
    idx: i,
    value: typeof d === 'object' ? d.value : d,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, '')})`}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
