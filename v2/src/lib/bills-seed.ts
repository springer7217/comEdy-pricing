export type SeedBill = {
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
  season: "Spring" | "Summer" | "Fall" | "Winter";
  credits_applied: boolean;
};

function bill(partial: {
  start: string;
  end: string;
  days: number;
  kwh: number;
  supply: number;
  delivery: number;
  taxes: number;
  supplyRate: number;
  market: number;
  season: SeedBill["season"];
}): SeedBill {
  const total = Number((partial.supply + partial.delivery + partial.taxes).toFixed(2));
  const effective = Number(((total / partial.kwh) * 100).toFixed(2));
  return {
    service_start: partial.start,
    service_end: partial.end,
    days: partial.days,
    total_kwh: partial.kwh,
    supply_amount: partial.supply,
    delivery_amount: partial.delivery,
    taxes_fees: partial.taxes,
    total_due: total,
    supply_rate: partial.supplyRate,
    effective_rate: effective,
    market_avg: partial.market,
    market_vs_paid_diff: Number((effective - partial.market).toFixed(2)),
    season: partial.season,
    credits_applied: partial.taxes < 0,
  };
}

/** Real household bills from ComEd PDFs (Plainfield, IL). */
export const SEEDED_BILLS: SeedBill[] = [
  bill({ start: "2025-04-30", end: "2025-05-30", days: 30, kwh: 740, supply: 63.02, delivery: 65.15, taxes: 12.73, supplyRate: 0.05015, market: 19.8, season: "Spring" }),
  bill({ start: "2025-05-30", end: "2025-06-30", days: 31, kwh: 1316, supply: 138.9, delivery: 100.9, taxes: 6.96, supplyRate: 0.08261, market: 22.4, season: "Summer" }),
  bill({ start: "2025-06-30", end: "2025-07-30", days: 30, kwh: 1363, supply: 130.6, delivery: 103.8, taxes: 18.24, supplyRate: 0.08261, market: 22.8, season: "Summer" }),
  bill({ start: "2025-07-30", end: "2025-08-28", days: 29, kwh: 1150, supply: 114.99, delivery: 90.64, taxes: 16.76, supplyRate: 0.08261, market: 22.1, season: "Summer" }),
  bill({ start: "2025-08-28", end: "2025-09-29", days: 32, kwh: 1038, supply: 104.31, delivery: 83.77, taxes: 12.49, supplyRate: 0.0826, market: 20.4, season: "Fall" }),
  bill({ start: "2025-09-29", end: "2025-10-29", days: 30, kwh: 749, supply: 61.57, delivery: 65.9, taxes: 16.17, supplyRate: 0.07873, market: 19.6, season: "Fall" }),
  bill({ start: "2025-10-29", end: "2025-11-26", days: 28, kwh: 604, supply: 48.13, delivery: 54.34, taxes: 8.49, supplyRate: 0.07873, market: 18.9, season: "Fall" }),
  bill({ start: "2025-11-26", end: "2025-12-30", days: 34, kwh: 768, supply: 67.89, delivery: 65.68, taxes: 15.13, supplyRate: 0.07873, market: 19.2, season: "Winter" }),
  bill({ start: "2025-12-30", end: "2026-01-29", days: 30, kwh: 692, supply: 69.32, delivery: 63.04, taxes: 0.35, supplyRate: 0.07841, market: 19.0, season: "Winter" }),
  bill({ start: "2026-01-29", end: "2026-02-27", days: 29, kwh: 655, supply: 69.09, delivery: 60.69, taxes: 1.78, supplyRate: 0.07841, market: 19.1, season: "Winter" }),
  bill({ start: "2026-02-27", end: "2026-03-30", days: 31, kwh: 679, supply: 64.56, delivery: 62.22, taxes: -11.31, supplyRate: 0.07841, market: 18.7, season: "Spring" }),
  bill({ start: "2026-03-30", end: "2026-04-29", days: 30, kwh: 679, supply: 73.46, delivery: 62.59, taxes: -4.92, supplyRate: 0.07841, market: 19.3, season: "Spring" }),
  bill({ start: "2026-04-29", end: "2026-05-29", days: 30, kwh: 1101, supply: 196.27, delivery: 89.57, taxes: -44.52, supplyRate: 0.07841, market: 20.6, season: "Spring" }),
];
