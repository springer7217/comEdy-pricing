import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";
import { getBills, getPriceSnapshot } from "@/lib/server/data";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [snap, bills] = await Promise.all([
      getPriceSnapshot({ data: { hours: 24 } }),
      getBills(),
    ]);
    return { prices: snap.prices, bills };
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <Dashboard initialPrices={initial.prices} initialBills={initial.bills} />;
}
