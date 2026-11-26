// HomeLedger seed data — a realistic household's first six months of money.
// The seed is generated relative to "today" so the dashboard always opens on a
// lived-in month instead of an empty one. Amounts are in US dollars.

export const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Interest', 'Refund', 'Other income',
];

export const EXPENSE_CATEGORIES = [
  'Housing', 'Groceries', 'Utilities', 'Transport', 'Dining out',
  'Entertainment', 'Health', 'Shopping', 'Subscriptions', 'Other',
];

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

function iso(year, month, day) {
  const d = new Date(year, month, day);
  return d.toISOString().slice(0, 10);
}

function monthShift(today, back) {
  const y = today.getFullYear();
  const m = today.getMonth() - back;
  return { year: y + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}

// One month of believable household activity. `jitter` keeps repeated months
// from looking copy-pasted while the totals stay in the same range.
function seedMonth(year, month, jitter, includePartial) {
  const rows = [];
  let n = 0;
  const id = () => `seed-${year}-${String(month + 1).padStart(2, '0')}-${++n}`;
  const push = (day, type, category, description, amount) => {
    rows.push({ id: id(), date: iso(year, month, day), type, category, description, amount });
  };

  push(1, 'income', 'Salary', 'Monthly salary — Alvarez household', 4200);
  push(15, 'income', 'Freelance', 'Weekend design work', 320 + jitter * 40);
  push(1, 'expense', 'Housing', 'Monthly rent', 1450);
  push(3, 'expense', 'Utilities', 'Electric bill', 118 + jitter * 12);
  push(5, 'expense', 'Utilities', 'Water bill', 46);
  push(6, 'expense', 'Utilities', 'Internet + mobile', 89);
  push(2, 'expense', 'Groceries', 'Weekly shop — Green Mart', 132 + jitter * 18);
  push(9, 'expense', 'Groceries', 'Weekly shop — Green Mart', 118 + jitter * 14);
  push(16, 'expense', 'Groceries', 'Weekly shop — Green Mart', 141 + jitter * 16);
  push(23, 'expense', 'Groceries', 'Weekly shop — Green Mart', 126 + jitter * 12);
  push(4, 'expense', 'Transport', 'Fuel', 52 + jitter * 8);
  push(18, 'expense', 'Transport', 'Fuel', 48 + jitter * 6);
  push(11, 'expense', 'Transport', 'Bus passes', 64);
  push(7, 'expense', 'Dining out', 'Pizza night with the kids', 38 + jitter * 9);
  push(21, 'expense', 'Dining out', 'Dinner at Rosa\u2019s', 54 + jitter * 11);
  push(14, 'expense', 'Entertainment', 'Streaming bundle', 24);
  push(20, 'expense', 'Entertainment', 'Cinema tickets', 32 + jitter * 6);
  push(10, 'expense', 'Health', 'Pharmacy', 27 + jitter * 8);
  push(12, 'expense', 'Shopping', 'Kids\u2019 school supplies', 46 + jitter * 15);
  push(26, 'expense', 'Subscriptions', 'Cloud storage', 9);
  push(28, 'expense', 'Other', 'Household odds and ends', 22 + jitter * 10);

  if (includePartial) {
    // This month is still in progress: keep only rows dated up to today.
    const todayDay = new Date().getDate();
    return rows.filter((r) => Number(r.date.slice(8, 10)) <= todayDay);
  }
  return rows;
}

export function buildSeedTransactions() {
  const today = new Date();
  const all = [];
  for (let back = 5; back >= 0; back -= 1) {
    const { year, month } = monthShift(today, back);
    const jitter = ((back * 37) % 10) / 10; // 0..0.9, deterministic per month
    all.push(...seedMonth(year, month, jitter, back === 0));
  }
  all.sort((a, b) => (a.date < b.date ? -1 : 1));
  return all;
}

export const DEFAULT_BUDGETS = {
  Housing: 1450,
  Groceries: 560,
  Utilities: 260,
  Transport: 180,
  'Dining out': 120,
  Entertainment: 90,
  Health: 80,
  Shopping: 120,
  Subscriptions: 45,
  Other: 60,
};

export function buildSeedGoals() {
  return [
    { id: 'goal-emergency', name: 'Emergency fund', target: 10000, saved: 6250, note: 'Six months of essential costs, for the unexpected.' },
    { id: 'goal-vacation', name: 'Summer beach trip', target: 2500, saved: 940, note: 'A week by the coast for the whole family.' },
    { id: 'goal-car', name: 'Replace the old car', target: 8000, saved: 1750, note: 'Trade in the 2012 sedan before it gives up.' },
  ];
}
