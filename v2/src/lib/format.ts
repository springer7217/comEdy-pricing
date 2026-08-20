export const CHICAGO_TZ = "America/Chicago";

export type PriceZone = "paying" | "cheap" | "fair" | "high" | "extreme";

export function priceZone(cents: number): PriceZone {
  if (cents <= 0) return "paying";
  if (cents <= 8) return "cheap";
  if (cents <= 10) return "fair";
  if (cents <= 30) return "high";
  return "extreme";
}

export const ZONE_META: Record<
  PriceZone,
  { label: string; action: string; tone: "pay" | "cheap" | "fair" | "high" | "extreme" }
> = {
  paying: {
    label: "Paying you",
    action: "ComEd is paying you to use power. Run the heavy loads.",
    tone: "pay",
  },
  cheap: {
    label: "Cheap",
    action: "Low rates. Laundry, EV charging, and pre-cooling make sense.",
    tone: "cheap",
  },
  fair: {
    label: "Normal",
    action: "Ordinary pricing. No rush, no penalty.",
    tone: "fair",
  },
  high: {
    label: "High",
    action: "Expensive window. Shift dishwashers, dryers, and charging if you can.",
    tone: "high",
  },
  extreme: {
    label: "Spike",
    action: "Price spike. Avoid heavy loads until it cools off.",
    tone: "extreme",
  },
};

export function formatCents(cents: number, digits = 1): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}${Math.abs(cents).toFixed(digits)}¢`;
}

export function formatDollars(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function formatChicagoTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: CHICAGO_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatChicagoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: CHICAGO_TZ,
    month: "short",
    day: "numeric",
  });
}

export function formatChicagoDateTime(iso: string): string {
  return `${formatChicagoDate(iso)} · ${formatChicagoTime(iso)}`;
}

export function chicagoHour(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return Number(hour);
}

export function seasonForDate(isoDate: string): "Spring" | "Summer" | "Fall" | "Winter" {
  const month = Number(isoDate.slice(5, 7));
  if (month === 12 || month <= 2) return "Winter";
  if (month <= 5) return "Spring";
  if (month <= 8) return "Summer";
  return "Fall";
}
