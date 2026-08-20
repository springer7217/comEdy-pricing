import { formatCents } from "@/lib/format";
import { TickNumber } from "@/components/tick-number";

export function StatGrid({
  avg,
  high,
  low,
}: {
  avg: number | null;
  high: number | null;
  low: number | null;
}) {
  const cells = [
    { label: "Avg", value: avg, tone: "text-cheap" },
    { label: "High", value: high, tone: "text-high" },
    { label: "Low", value: low, tone: "text-pay" },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-border bg-surface p-3 sm:p-4"
        >
          <p className={`text-xs font-semibold uppercase tracking-widest ${cell.tone}`}>
            {cell.label}
          </p>
          <TickNumber
            value={cell.value == null ? "—" : formatCents(cell.value)}
            className="mt-2 block text-xl font-medium tracking-tight text-fg sm:text-2xl"
          />
        </div>
      ))}
    </div>
  );
}
