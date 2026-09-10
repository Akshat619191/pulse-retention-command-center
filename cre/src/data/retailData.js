const regions = ["North", "South", "East", "West"];
const channels = ["Online", "Store", "Mobile"];
const categories = [
  "Electronics",
  "Fashion",
  "Home",
  "Beauty",
  "Sports"
];

const segments = ["VIP", "Loyal", "Growing", "At Risk", "Dormant"];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDate() {
  const start = new Date("2026-06-01");
  const end = new Date("2026-09-10");

  return new Date(
    start.getTime() +
      Math.random() * (end.getTime() - start.getTime())
  );
}

export const customers = Array.from({ length: 1000 }, (_, index) => {
  const segment = randomItem(segments);

  return {
    id: `CUST-${String(index + 1).padStart(4, "0")}`,
    name: `Customer ${index + 1}`,
    region: randomItem(regions),
    segment,
    lifetimeValue: Math.round(15000 + Math.random() * 135000),
    orders: Math.floor(2 + Math.random() * 25),
    churnRisk:
      segment === "Dormant"
        ? Math.round(75 + Math.random() * 24)
        : segment === "At Risk"
        ? Math.round(50 + Math.random() * 30)
        : Math.round(Math.random() * 45)
  };
});

export const transactions = Array.from({ length: 5000 }, (_, index) => ({
  id: `ORD-${String(index + 1).padStart(5, "0")}`,
  customerId: customers[Math.floor(Math.random() * customers.length)].id,
  date: randomDate().toISOString().split("T")[0],
  revenue: Math.round(500 + Math.random() * 25000),
  region: randomItem(regions),
  channel: randomItem(channels),
  category: randomItem(categories)
}));