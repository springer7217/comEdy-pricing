import { useMemo, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BillRow } from "@/lib/server/data";
import { formatCents, formatDollars } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TickNumber } from "@/components/tick-number";

type Season = "All" | "Spring" | "Summer" | "Fall" | "Winter";
type SortKey = "newest" | "oldest" | "rateHigh" | "rateLow" | "spendHigh" | "spendLow";

function monthLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function rangeLabel(bill: BillRow) {
  const start = new Date(`${bill.service_start}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(`${bill.service_end}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} — ${end}`;
}

export function BillsView({ bills }: { bills: BillRow[] }) {
  const years = useMemo(() => {
    const set = new Set(bills.map((b) => b.service_end.slice(0, 4)));
    return ["All", ...Array.from(set).sort().reverse()];
  }, [bills]);

  const [season, setSeason] = useState<Season>("All");
  const [year, setYear] = useState("All");
  const [sort, setSort] = useState<SortKey>("newest");
  const [open, setOpen] = useState<BillRow | null>(null);

  const filtered = useMemo(() => {
    let rows = bills.filter((b) => {
      if (season !== "All" && b.season !== season) return false;
      if (year !== "All" && !b.service_end.startsWith(year)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "newest") return b.service_start.localeCompare(a.service_start);
      if (sort === "oldest") return a.service_start.localeCompare(b.service_start);
      if (sort === "rateHigh") return b.effective_rate - a.effective_rate;
      if (sort === "rateLow") return a.effective_rate - b.effective_rate;
      if (sort === "spendHigh") return b.total_due - a.total_due;
      return a.total_due - b.total_due;
    });
    return rows;
  }, [bills, season, year, sort]);

  const totals = useMemo(() => {
    if (!filtered.length) {
      return { count: 0, spent: 0, rate: 0, vs: 0 };
    }
    const spent = filtered.reduce((s, b) => s + b.total_due, 0);
    const rate = filtered.reduce((s, b) => s + b.effective_rate, 0) / filtered.length;
    const vs = filtered.reduce((s, b) => s + b.market_vs_paid_diff, 0) / filtered.length;
    return { count: filtered.length, spent, rate, vs };
  }, [filtered]);

  const seasonChart = useMemo(() => {
    const groups = ["Winter", "Spring", "Summer", "Fall"].map((s) => {
      const rows = filtered.filter((b) => b.season === s);
      const avg = rows.length
        ? rows.reduce((n, b) => n + b.effective_rate, 0) / rows.length
        : 0;
      return { season: s, rate: Number(avg.toFixed(2)) };
    });
    return groups;
  }, [filtered]);

  const monthlyChart = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.service_end.localeCompare(b.service_end))
        .map((b) => ({
          month: monthLabel(b.service_end),
          spent: b.total_due,
        })),
    [filtered],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Score label="Bills" value={String(totals.count)} />
        <Score label="Spent" value={formatDollars(totals.spent)} />
        <Score label="Avg effective" value={formatCents(totals.rate, 2)} />
        <Score
          label="Vs market"
          value={`${totals.vs > 0 ? "+" : ""}${totals.vs.toFixed(2)}¢`}
          tone={totals.vs > 0 ? "text-high" : "text-cheap"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["All", "Spring", "Summer", "Fall", "Winter"] as Season[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeason(s)}
            className={cn(
              "pressable h-9 rounded-full border px-3 text-sm",
              season === s
                ? "border-accent bg-accent text-accent-fg"
                : "border-border bg-surface text-muted hover:text-fg",
            )}
          >
            {s}
          </button>
        ))}
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="pressable h-9 rounded-full border border-border bg-surface px-3 text-sm text-fg"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y === "All" ? "All years" : y}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="pressable h-9 rounded-full border border-border bg-surface px-3 text-sm text-fg"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="rateHigh">Highest rate</option>
          <option value="rateLow">Lowest rate</option>
          <option value="spendHigh">Highest spend</option>
          <option value="spendLow">Lowest spend</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChartCard title="Effective rate by season">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={seasonChart} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="season" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "#27272a" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as { season: string; rate: number };
                  return (
                    <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
                      {d.season}: {d.rate.toFixed(2)}¢
                    </div>
                  );
                }}
              />
              <Bar dataKey="rate" fill="#a1a1aa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly spend">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChart} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "#27272a" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as { month: string; spent: number };
                  return (
                    <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
                      {d.month}: {formatDollars(d.spent)}
                    </div>
                  );
                }}
              />
              <Bar dataKey="spent" fill="#e4e4e7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Bill history</h2>
          <span className="text-xs text-subtle">{filtered.length} bills</span>
        </div>
        <div className="space-y-2">
          {filtered.map((bill) => (
            <button
              key={bill.id}
              type="button"
              onClick={() => setOpen(bill)}
              className="pressable w-full rounded-xl border border-border bg-surface p-4 text-left hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-fg">{rangeLabel(bill)}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {bill.days} days · {bill.total_kwh.toLocaleString()} kWh
                  </p>
                </div>
                <p className="tabular text-lg font-medium">{formatDollars(bill.total_due)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-subtle">Effective</p>
                  <p className="tabular font-medium">{formatCents(bill.effective_rate, 2)}</p>
                </div>
                <div>
                  <p className="text-xs text-subtle">Vs market</p>
                  <p
                    className={cn(
                      "tabular font-medium",
                      bill.market_vs_paid_diff > 0 ? "text-high" : "text-cheap",
                    )}
                  >
                    {bill.market_vs_paid_diff > 0 ? "+" : ""}
                    {bill.market_vs_paid_diff.toFixed(2)}¢
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Drawer.Root open={Boolean(open)} onOpenChange={(v) => !v && setOpen(null)}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-bg/70" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border border-border bg-surface p-5 outline-none">
            {open ? <BillDetail bill={open} onClose={() => setOpen(null)} /> : null}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function Score({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-widest text-subtle">{label}</p>
      <TickNumber value={value} className={cn("mt-1 block text-2xl font-medium", tone)} />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest text-subtle">{title}</p>
      <div className="h-48">{children}</div>
    </div>
  );
}

function BillDetail({ bill, onClose }: { bill: BillRow; onClose: () => void }) {
  const supplyRate = (bill.supply_amount / bill.total_kwh) * 100;
  const deliveryRate = (bill.delivery_amount / bill.total_kwh) * 100;
  return (
    <div>
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <Drawer.Title className="text-lg font-medium">{rangeLabel(bill)}</Drawer.Title>
          <p className="mt-1 text-sm text-muted">
            {bill.days} days · {bill.total_kwh.toLocaleString()} kWh
          </p>
        </div>
        <button type="button" onClick={onClose} className="pressable text-2xl leading-none text-muted">
          ×
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{bill.season}</Badge>
        {bill.credits_applied ? <Badge>Credits applied</Badge> : null}
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Total due" value={formatDollars(bill.total_due)} />
        <Row
          label="Supply"
          value={`${formatDollars(bill.supply_amount)} · ${supplyRate.toFixed(2)}¢`}
        />
        <Row
          label="Delivery"
          value={`${formatDollars(bill.delivery_amount)} · ${deliveryRate.toFixed(2)}¢`}
        />
        <Row label="Taxes & fees" value={formatDollars(bill.taxes_fees)} />
        <Row label="Effective rate" value={formatCents(bill.effective_rate, 2)} />
        <Row
          label="Vs market avg"
          value={`${bill.market_vs_paid_diff > 0 ? "+" : ""}${bill.market_vs_paid_diff.toFixed(2)}¢`}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}
