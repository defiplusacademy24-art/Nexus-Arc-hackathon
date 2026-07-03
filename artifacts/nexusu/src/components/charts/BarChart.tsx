import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface BarChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Array<any>;
  xKey: string;
  bars: Array<{ key: string; color: string; label: string }>;
  height?: number;
  formatY?: (v: number) => string;
  rounded?: boolean;
}

function CustomTooltip({ active, payload, label, formatY }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  formatY?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-white/10 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-stone-600 dark:text-white/60 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-stone-500 dark:text-white/50">{p.name}:</span>
          <span className="font-semibold text-stone-800 dark:text-white">
            {formatY ? formatY(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BarChart({ data, xKey, bars, height = 200, formatY }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-stone-100 dark:text-white/5" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: 'currentColor' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'currentColor' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatY ? formatY(v) : v}
        />
        <Tooltip content={<CustomTooltip formatY={formatY} />} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        ))}
      </ReBarChart>
    </ResponsiveContainer>
  );
}
