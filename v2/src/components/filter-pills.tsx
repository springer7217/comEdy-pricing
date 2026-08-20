import { cn } from "@/lib/utils";

export const RANGE_OPTIONS = [
  { hours: 6, label: "6h" },
  { hours: 12, label: "12h" },
  { hours: 24, label: "24h" },
  { hours: 168, label: "7d" },
  { hours: 720, label: "30d" },
] as const;

export function FilterPills({
  value,
  onChange,
}: {
  value: number;
  onChange: (hours: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-widest text-subtle">Show</span>
      <div className="inline-flex rounded-full border border-border bg-surface p-1">
        {RANGE_OPTIONS.map((opt) => {
          const active = opt.hours === value;
          return (
            <button
              key={opt.hours}
              type="button"
              onClick={() => onChange(opt.hours)}
              className={cn(
                "pressable min-h-9 rounded-full px-3 text-sm font-medium",
                active ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
