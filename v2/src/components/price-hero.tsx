import { formatCents, formatChicagoTime, priceZone, ZONE_META, type PriceZone } from "@/lib/format";
import { TickNumber } from "@/components/tick-number";
import { ZoneDot } from "@/components/zone-dot";
import { Badge } from "@/components/ui/badge";

export function PriceHero({
  price,
  recordedAt,
}: {
  price: number | null;
  recordedAt: string | null;
}) {
  const zone: PriceZone = price == null ? "fair" : priceZone(price);
  const meta = ZONE_META[zone];

  return (
    <section className="stagger-in rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-subtle">Now</p>
          <div className="mt-2 flex items-end gap-2">
            <TickNumber
              value={price == null ? "—" : formatCents(price)}
              className="text-5xl font-medium tracking-tight text-fg sm:text-6xl"
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {recordedAt ? `Updated ${formatChicagoTime(recordedAt)}` : "Waiting on ComEd"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 pt-1">
          <ZoneDot zone={zone} pulse />
          <Badge className="text-fg">
            <ZoneDot zone={zone} />
            {meta.label}
          </Badge>
        </div>
      </div>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">{meta.action}</p>
    </section>
  );
}
