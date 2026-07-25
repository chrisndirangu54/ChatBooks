import { addTransaction, type NewTransaction } from "@/lib/data/transactions";

const SEED_TEMPLATE: Array<Omit<NewTransaction, "createdAt">> = [
  { type: "sale", amount: 1500, category: "sales", note: "Rice - 3 bags", source: "chat", confidence: 0.95 },
  { type: "sale", amount: 800, category: "sales", note: "Sugar", source: "chat", confidence: 0.9 },
  { type: "expense", amount: 2300, category: "inventory", note: "Receipt from Supplier XYZ", source: "receipt", confidence: 0.6 },
  { type: "sale", amount: 2200, category: "sales", note: "Milk crates", source: "chat", confidence: 0.92 },
  { type: "expense", amount: 400, category: "transport", note: "Delivery fuel", source: "manual", confidence: 1 },
  { type: "sale", amount: 1750, category: "sales", note: "Flour - bulk order", source: "chat", confidence: 0.88 },
  { type: "expense", amount: 900, category: "utilities", note: "Electricity bill", source: "manual", confidence: 1 },
  { type: "sale", amount: 3100, category: "sales", note: "Weekend market sales", source: "chat", confidence: 0.9 },
  { type: "expense", amount: 1200, category: "wages", note: "Assistant weekly pay", source: "manual", confidence: 1 },
  { type: "sale", amount: 1950, category: "sales", note: "Rice + sugar bundle", source: "chat", confidence: 0.93 },
];

export async function seedDemoData(uid: string): Promise<void> {
  const now = Date.now();
  await Promise.all(
    SEED_TEMPLATE.map((item, index) =>
      addTransaction(uid, {
        ...item,
        createdAt: now - (SEED_TEMPLATE.length - index) * 6 * 60 * 60 * 1000,
      }),
    ),
  );
}
