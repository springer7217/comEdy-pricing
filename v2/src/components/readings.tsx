import { formatCents, formatChicagoDateTime, priceZone } from "@/lib/format";
import type { PriceRow } from "@/lib/server/data";
import { ZoneDot } from "@/components/zone-dot";
import { Button } from "@/components/ui/button";

export function Readings({
  rows,
  shown,
  onMore,
}: {
  rows: PriceRow[];
  shown: number;
  onMore: () => void;
}) {
  const visible = rows.slice(0, shown);
  const remaining = rows.length - shown;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-fg">Recent readings</h2>
        <span className="text-xs text-subtle">{rows.length} points</span>
      </div>
      <ul className="space-y-1.5">
        {visible.map((row, i) => {
          const zone = priceZone(row.price);
          return (
            <li
              key={`${row.recorded_at}-${i}`}
              className="pressable flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <div className="flex items-center gap-3">
                <ZoneDot zone={zone} />
                <div>
                  <div className="tabular text-lg font-medium tracking-tight">
                    {formatCents(row.price)}
                  </div>
                  <div className="text-xs text-subtle">{formatChicagoDateTime(row.recorded_at)}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {remaining > 0 ? (
        <Button variant="outline" className="mt-4 w-full" onClick={onMore}>
          Load {Math.min(10, remaining)} more
        </Button>
      ) : null}
    </section>
  );
}
