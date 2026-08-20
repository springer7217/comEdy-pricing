import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { SEEDED_BILLS } from "@/lib/bills-seed";
import { chicagoHour } from "@/lib/format";
import { num as toNum } from "@/lib/utils";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ComedPoint = { millisUTC: string; price: string };

async function fetchLiveFeed(): Promise<{ recorded_at: string; price: number }[]> {
  const res = await fetch(
    "https://hourlypricing.comed.com/api?type=5minutefeed&format=json",
    { signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) throw new Error(`ComEd feed ${res.status}`);
  const rows = (await res.json()) as ComedPoint[];
  return rows
    .map((r) => ({
      recorded_at: new Date(Number(r.millisUTC)).toISOString(),
      price: Number(r.price),
    }))
    .filter((r) => Number.isFinite(r.price) && Number.isFinite(Date.parse(r.recorded_at)));
}

function syntheticPrice(at: Date, rand: () => number): number {
  const hour = chicagoHour(at);
  const month = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "2-digit" }).format(at),
  );
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(at);
  const weekend = weekday === "Sat" || weekday === "Sun";
  const summer = month >= 6 && month <= 8;

  let base = 3.4;
  if (hour < 6) base = 2.1;
  else if (hour < 9) base = 4.2;
  else if (hour < 14) base = 5.8;
  else if (hour < 17) base = summer ? 11 : 7.2;
  else if (hour < 21) base = summer ? 14 : 8.4;
  else base = 4.8;

  if (weekend) base *= 0.88;
  let price = base + (rand() - 0.45) * 2.4;

  if (summer && hour >= 14 && hour <= 19 && rand() < 0.035) {
    price += 20 + rand() * 90;
  }
  if (!summer && hour >= 17 && hour <= 20 && rand() < 0.02) {
    price += 8 + rand() * 18;
  }
  if (hour >= 1 && hour <= 5 && rand() < 0.012) {
    price = -(0.2 + rand() * 1.4);
  }
  return Math.round(price * 10) / 10;
}

async function ensureSeeded() {
  const sql = await getSql();
  const [{ n: billCount }] = await sql<{ n: number }>`select count(*)::int as n from comed_bills`;
  if (billCount === 0) {
    for (const b of SEEDED_BILLS) {
      await sql`
        insert into comed_bills (
          service_start, service_end, days, total_kwh, supply_amount, delivery_amount,
          taxes_fees, total_due, supply_rate, effective_rate, market_avg,
          market_vs_paid_diff, season, credits_applied
        ) values (
          ${b.service_start}::date, ${b.service_end}::date, ${b.days}, ${b.total_kwh},
          ${b.supply_amount}, ${b.delivery_amount}, ${b.taxes_fees}, ${b.total_due},
          ${b.supply_rate}, ${b.effective_rate}, ${b.market_avg}, ${b.market_vs_paid_diff},
          ${b.season}, ${b.credits_applied}
        )
        on conflict (service_start) do nothing
      `;
    }
  }

  const [{ n: priceCount }] = await sql<{ n: number }>`select count(*)::int as n from comed_prices`;
  if (priceCount < 200) {
    const now = Date.now();
    const stepMs = 60 * 60 * 1000;
    const start = now - 30 * 24 * 60 * 60 * 1000;
    const rand = mulberry32(20260819);
    const batch: { at: string; price: number }[] = [];
    for (let t = start; t < now; t += stepMs) {
      const at = new Date(t);
      batch.push({ at: at.toISOString(), price: syntheticPrice(at, rand) });
    }
    for (let i = 0; i < batch.length; i += 120) {
      const slice = batch.slice(i, i + 120);
      const values = slice
        .map((_, idx) => `($${idx * 2 + 1}::timestamptz, $${idx * 2 + 2}::numeric, 'seed')`)
        .join(",");
      const params = slice.flatMap((p) => [p.at, p.price]);
      await sql.query(
        `insert into comed_prices (recorded_at, price, source) values ${values} on conflict (recorded_at) do nothing`,
        params,
      );
    }
  }
}

async function upsertLive() {
  try {
    const live = await fetchLiveFeed();
    if (!live.length) return;
    const sql = await getSql();
    for (let i = 0; i < live.length; i += 80) {
      const slice = live.slice(i, i + 80);
      const values = slice
        .map((_, idx) => `($${idx * 2 + 1}::timestamptz, $${idx * 2 + 2}::numeric, 'comed')`)
        .join(",");
      const params = slice.flatMap((p) => [p.recorded_at, p.price]);
      await sql.query(
        `insert into comed_prices (recorded_at, price, source) values ${values}
         on conflict (recorded_at) do update set price = excluded.price, source = 'comed'`,
        params,
      );
    }
  } catch (err) {
    console.error("[comed] live feed failed", err);
  }
}

export type PriceRow = {
  recorded_at: string;
  price: number;
  source: string;
};

export const getPriceSnapshot = createServerFn({ method: "GET" })
  .validator((input: { hours: number }) => ({
    hours: Math.min(Math.max(Number(input.hours) || 24, 1), 720),
  }))
  .handler(async ({ data }) => {
    await upsertLive();
    await ensureSeeded();
    const sql = await getSql();
    const since = new Date(Date.now() - data.hours * 60 * 60 * 1000).toISOString();
    const rows = await sql<{ recorded_at: string; price: unknown; source: string }>`
      select recorded_at, price, source
      from comed_prices
      where recorded_at >= ${since}::timestamptz
      order by recorded_at desc
      limit 4000
    `;
    const prices: PriceRow[] = rows.map((r) => ({
      recorded_at: typeof r.recorded_at === "string" ? r.recorded_at : new Date(r.recorded_at).toISOString(),
      price: toNum(r.price),
      source: r.source,
    }));
    return { hours: data.hours, prices };
  });

export type BillRow = {
  id: number;
  service_start: string;
  service_end: string;
  days: number;
  total_kwh: number;
  supply_amount: number;
  delivery_amount: number;
  taxes_fees: number;
  total_due: number;
  supply_rate: number;
  effective_rate: number;
  market_avg: number;
  market_vs_paid_diff: number;
  season: string;
  credits_applied: boolean;
};

export const getBills = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from comed_bills order by service_start desc
  `;
  return rows.map((r) => ({
    id: toNum(r.id),
    service_start: String(r.service_start).slice(0, 10),
    service_end: String(r.service_end).slice(0, 10),
    days: toNum(r.days),
    total_kwh: toNum(r.total_kwh),
    supply_amount: toNum(r.supply_amount),
    delivery_amount: toNum(r.delivery_amount),
    taxes_fees: toNum(r.taxes_fees),
    total_due: toNum(r.total_due),
    supply_rate: toNum(r.supply_rate),
    effective_rate: toNum(r.effective_rate),
    market_avg: toNum(r.market_avg),
    market_vs_paid_diff: toNum(r.market_vs_paid_diff),
    season: String(r.season),
    credits_applied: Boolean(r.credits_applied),
  })) satisfies BillRow[];
});
