import { cn } from "@/lib/utils";
import { type PriceZone } from "@/lib/format";

const TONE: Record<PriceZone, string> = {
  paying: "bg-pay",
  cheap: "bg-cheap",
  fair: "bg-fair",
  high: "bg-high",
  extreme: "bg-extreme",
};

export function ZoneDot({ zone, pulse }: { zone: PriceZone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-3.5">
      {pulse ? (
        <span className={cn("zone-ring absolute inset-0 rounded-full", TONE[zone])} />
      ) : null}
      <span className={cn("relative size-3.5 rounded-full", TONE[zone])} />
    </span>
  );
}
