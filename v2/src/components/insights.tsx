import { formatCents, formatChicagoTime, chicagoHour, priceZone } from "@/lib/format";
import type { PriceRow } from "@/lib/server/data";

export function Insights({ rows }: { rows: PriceRow[] }) {
  if (!rows.length) return null;

  const cheapest = rows.reduce((a, b) => (b.price < a.price ? b : a));
  const priciest = rows.reduce((a, b) => (b.price > a.price ? b : a));
  const cheapShare = Math.round(
    (rows.filter((r) => priceZone(r.price) === "cheap" || priceZone(r.price) === "paying").length /
      rows.length) *
      100,
  );
  const hour = chicagoHour(cheapest.recorded_at);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Insight
        label="Cheapest tick"
        value={formatCents(cheapest.price)}
        hint={`${formatChicagoTime(cheapest.recorded_at)} · hour ${hour}`}
      />
      <Insight
        label="Highest tick"
        value={formatCents(priciest.price)}
        hint={formatChicagoTime(priciest.recorded_at)}
      />
      <Insight label="Time cheap" value={`${cheapShare}%`} hint="At or below 8¢" />
    </div>
  );
}

function Insight({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-subtle">{label}</p>
      <p className="tabular mt-1 text-lg font-medium text-fg">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
