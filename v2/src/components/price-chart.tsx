import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatChicagoDate, formatChicagoTime } from "@/lib/format";
import type { PriceRow } from "@/lib/server/data";

function downsample(rows: PriceRow[], max = 360): PriceRow[] {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, i) => i % step === 0);
}

export function PriceChart({ data, hours }: { data: PriceRow[]; hours: number }) {
  const longRange = hours > 24;
  const chartData = useMemo(() => {
    const chronological = downsample([...data].reverse());
    return chronological.map((row) => ({
      t: row.recorded_at,
      price: row.price,
      label: longRange ? formatChicagoDate(row.recorded_at) : formatChicagoTime(row.recorded_at),
    }));
  }, [data, longRange]);

  return (
    <div className="h-64 rounded-xl border border-border bg-surface p-3 sm:h-72 sm:p-4 lg:h-full lg:min-h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}`}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "#3f3f46", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as { t: string; price: number } | undefined;
              if (!point) return null;
              return (
                <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-fg shadow-lg">
                  <div className="tabular text-sm font-medium">{point.price.toFixed(1)}¢</div>
                  <div className="mt-0.5 text-subtle">
                    {longRange
                      ? `${formatChicagoDate(point.t)} ${formatChicagoTime(point.t)}`
                      : formatChicagoTime(point.t)}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#4ade80"
            strokeWidth={2}
            fill="url(#priceFill)"
            dot={false}
            isAnimationActive
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
