import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { getBills, getPriceSnapshot, type BillRow, type PriceRow } from "@/lib/server/data";
import { AppHeader } from "@/components/app-header";
import { BillsView } from "@/components/bills-view";
import { FilterPills } from "@/components/filter-pills";
import { Insights } from "@/components/insights";
import { PriceChart } from "@/components/price-chart";
import { PriceHero } from "@/components/price-hero";
import { Readings } from "@/components/readings";
import { StatGrid } from "@/components/stat-grid";
import { cn } from "@/lib/utils";

type Tab = "live" | "bills";

export function Dashboard({
  initialPrices,
  initialBills,
}: {
  initialPrices: PriceRow[];
  initialBills: BillRow[];
}) {
  const [tab, setTab] = useState<Tab>("live");
  const [hours, setHours] = useState(24);
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices);
  const [bills, setBills] = useState<BillRow[]>(initialBills);
  const [shown, setShown] = useState(5);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pull = useRef({ start: 0, pulling: false });

  const loadPrices = useCallback(async (h: number, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const snap = await getPriceSnapshot({ data: { hours: h } });
      setPrices(snap.prices);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    void loadPrices(hours);
  }, [hours, loadPrices]);

  useEffect(() => {
    if (!initialBills.length) {
      void getBills().then(setBills).catch(() => setBills([]));
    }
  }, [initialBills.length]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadPrices(hours, true);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [hours, loadPrices]);

  const stats = useMemo(() => {
    if (!prices.length) return { avg: null, high: null, low: null };
    const vals = prices.map((p) => p.price);
    return {
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      high: Math.max(...vals),
      low: Math.min(...vals),
    };
  }, [prices]);

  const latest = prices[0] ?? null;

  function onFilter(next: number) {
    setHours(next);
    setShown(5);
  }

  function onTouchStart(e: TouchEvent) {
    if (window.scrollY > 4) return;
    pull.current = { start: e.touches[0]?.clientY ?? 0, pulling: true };
  }
  function onTouchEnd(e: TouchEvent) {
    if (!pull.current.pulling) return;
    const end = e.changedTouches[0]?.clientY ?? 0;
    pull.current.pulling = false;
    if (end - pull.current.start > 70) void loadPrices(hours);
  }

  return (
    <div
      className="min-h-dvh bg-bg text-fg"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <AppHeader onRefresh={() => void loadPrices(hours)} refreshing={refreshing} />

      <div className="mx-auto max-w-5xl px-5 pb-16">
        <div className="mt-4 flex border-b border-border">
          {(
            [
              ["live", "Live prices"],
              ["bills", "My bills"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "pressable relative flex-1 py-3 text-sm font-medium",
                tab === id ? "text-fg" : "text-subtle",
              )}
            >
              {label}
              <span
                className={cn(
                  "absolute inset-x-6 -bottom-px h-0.5 origin-center rounded-full bg-cheap transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  tab === id ? "scale-x-100" : "scale-x-0",
                )}
              />
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "live" ? (
            <div key="live" className="stagger-in space-y-5">
              <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
                <div className="space-y-5">
                  <PriceHero price={latest?.price ?? null} recordedAt={latest?.recorded_at ?? null} />
                  <StatGrid avg={stats.avg} high={stats.high} low={stats.low} />
                </div>
                <div className="space-y-5">
                  <FilterPills value={hours} onChange={onFilter} />
                  <PriceChart data={prices} hours={hours} />
                </div>
              </div>
              <Insights rows={prices} />
              <Readings
                rows={prices}
                shown={shown}
                onMore={() => setShown((n) => n + 10)}
              />
              {loading ? (
                <p className="text-center text-xs text-subtle">Fetching ComEd feed…</p>
              ) : null}
            </div>
          ) : (
            <div key="bills" className="stagger-in">
              <BillsView bills={bills} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
