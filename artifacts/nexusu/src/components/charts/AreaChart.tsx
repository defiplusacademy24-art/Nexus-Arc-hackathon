import {
  AreaChart as ReAreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

interface AreaChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Array<any>;
  xKey: string;
  areas: Array<{ key: string; color: string; label: string; fillOpacity?: number }>;
  height?: number;
  showGrid?: boolean;
  formatY?: (v: number) => string;
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
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-stone-500 dark:text-white/50">{p.name}:</span>
          <span className="font-semibold text-stone-800 dark:text-white">
            {formatY ? formatY(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AreaChart({ data, xKey, areas, height = 200, showGrid = true, formatY }: AreaChartProps) {
  // Fixed min size avoids recharts warn/throw when the parent layout is still measuring.
  return (
    <div style={{ width: '100%', height, minHeight: height, minWidth: 0 }}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={height}>
      <ReAreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          {areas.map((a) => (
            <linearGradient key={a.key} id={`grad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={a.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={a.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-stone-100 dark:text-white/5" />
        )}
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: 'currentColor', className: 'text-stone-400 dark:text-white/30' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'currentColor', className: 'text-stone-400 dark:text-white/30' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatY ? formatY(v) : v}
        />
        <Tooltip content={<CustomTooltip formatY={formatY} />} />
        {areas.map((a) => (
          <Area
            key={a.key}
            type="monotone"
            dataKey={a.key}
            name={a.label}
            stroke={a.color}
            strokeWidth={2}
            fill={`url(#grad-${a.key})`}
            fillOpacity={a.fillOpacity ?? 1}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </ReAreaChart>
    </ResponsiveContainer>
    </div>
  );
}
