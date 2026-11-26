// HomeLedger state — load, save and summarise the household's money.
// Everything lives in localStorage under one key, so the site works fully
// offline and keeps the family's figures between visits.

import { buildSeedTransactions, buildSeedGoals, DEFAULT_BUDGETS } from './data.js';

const STORAGE_KEY = 'homeledger.v1';

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function formatMoney(amount) {
  return moneyFmt.format(amount);
}

export function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

export function monthKeyOf(isoDate) {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function freshState() {
  return {
    transactions: buildSeedTransactions(),
    budgets: { ...DEFAULT_BUDGETS },
    goals: buildSeedGoals(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const state = freshState();
      saveState(state);
      return state;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.transactions) || typeof parsed.budgets !== 'object' || !Array.isArray(parsed.goals)) {
      return freshState();
    }
    return parsed;
  } catch {
    return freshState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetToSeed() {
  const state = freshState();
  saveState(state);
  return state;
}

function nextId(state) {
  return `tx-${Date.now().toString(36)}-${state.transactions.length}`;
}

export function addTransaction(state, tx) {
  const clean = {
    id: nextId(state),
    date: tx.date,
    type: tx.type === 'income' ? 'income' : 'expense',
    category: tx.category,
    description: tx.description.trim(),
    amount: Math.round(Math.abs(Number(tx.amount)) * 100) / 100,
  };
  state.transactions.push(clean);
  state.transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
  saveState(state);
  return clean;
}

export function updateTransaction(state, id, patch) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return false;
  if (patch.date) tx.date = patch.date;
  if (patch.type) tx.type = patch.type === 'income' ? 'income' : 'expense';
  if (patch.category) tx.category = patch.category;
  if (patch.description !== undefined) tx.description = patch.description.trim();
  if (patch.amount !== undefined) tx.amount = Math.round(Math.abs(Number(patch.amount)) * 100) / 100;
  state.transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
  saveState(state);
  return true;
}

export function deleteTransaction(state, id) {
  const before = state.transactions.length;
  state.transactions = state.transactions.filter((t) => t.id !== id);
  if (state.transactions.length !== before) saveState(state);
  return state.transactions.length !== before;
}

export function setBudget(state, category, amount) {
  state.budgets[category] = Math.max(0, Math.round(Number(amount) * 100) / 100);
  saveState(state);
}

export function addToGoal(state, goalId, amount) {
  const goal = state.goals.find((g) => g.id === goalId);
  if (!goal) return false;
  goal.saved = Math.round((goal.saved + Number(amount)) * 100) / 100;
  if (goal.saved < 0) goal.saved = 0;
  saveState(state);
  return true;
}

export function addGoal(state, name, target) {
  const goal = {
    id: `goal-${Date.now().toString(36)}`,
    name: name.trim(),
    target: Math.round(Math.abs(Number(target)) * 100) / 100,
    saved: 0,
    note: '',
  };
  state.goals.push(goal);
  saveState(state);
  return goal;
}

// --- summaries -----------------------------------------------------------

export function sumByType(transactions, type, monthKey) {
  return transactions
    .filter((t) => t.type === type && (!monthKey || monthKeyOf(t.date) === monthKey))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function spendByCategory(transactions, monthKey) {
  const totals = {};
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    if (monthKey && monthKeyOf(t.date) !== monthKey) continue;
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  }
  return totals;
}

export function monthSummary(state, monthKey) {
  const income = sumByType(state.transactions, 'income', monthKey);
  const spent = sumByType(state.transactions, 'expense', monthKey);
  const left = income - spent;
  return {
    income,
    spent,
    left,
    savingsRate: income > 0 ? (left / income) * 100 : 0,
    topCategories: Object.entries(spendByCategory(state.transactions, monthKey))
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

// Last `count` months ending with the current month, oldest first.
export function lastMonths(count) {
  const now = new Date();
  const out = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d),
    });
  }
  return out;
}

export function budgetStatus(state, monthKey) {
  const spent = spendByCategory(state.transactions, monthKey);
  return Object.entries(state.budgets)
    .map(([category, limit]) => {
      const used = spent[category] || 0;
      const pct = limit > 0 ? (used / limit) * 100 : 0;
      const status = pct > 100 ? 'over' : pct >= 80 ? 'near' : 'ok';
      return { category, limit, used, left: limit - used, pct, status };
    })
    .sort((a, b) => b.pct - a.pct);
}

// Plain-language saving tips derived from the household's own numbers.
export function savingTips(state, monthKey) {
  const summary = monthSummary(state, monthKey);
  const tips = [];
  const byCat = summary.topCategories;

  const dining = byCat.find((c) => c.category === 'Dining out');
  if (dining && dining.amount >= 80) {
    tips.push({
      title: 'Cook one more night in',
      body: `Dining out cost ${formatMoney(dining.amount)} this month. Swapping one restaurant dinner for a home-cooked meal saves roughly ${formatMoney(35)} a week.`,
    });
  }
  const subs = state.transactions.filter(
    (t) => t.category === 'Subscriptions' && monthKeyOf(t.date) === monthKey,
  );
  const subsTotal = subs.reduce((s, t) => s + t.amount, 0);
  if (subsTotal >= 30) {
    tips.push({
      title: 'Audit the subscriptions',
      body: `${formatMoney(subsTotal)} went to subscriptions this month (${subs.length} charges). Cancel one unused service and keep the money.`,
    });
  }
  if (summary.savingsRate < 10) {
    tips.push({
      title: 'Pay yourself first',
      body: `This month's savings rate is ${summary.savingsRate.toFixed(0)}%. Move ${formatMoney(100)} to savings on payday, before spending starts.`,
    });
  } else {
    tips.push({
      title: 'Savings rate is healthy',
      body: `At ${summary.savingsRate.toFixed(0)}% saved this month, you are ahead of most households. Consider topping up the emergency fund with the surplus.`,
    });
  }
  const groceries = byCat.find((c) => c.category === 'Groceries');
  if (groceries) {
    tips.push({
      title: 'Plan the weekly shop',
      body: `Groceries are ${formatMoney(groceries.amount)} this month — your second-biggest variable cost after housing. A list and one shop a week cuts impulse buys.`,
    });
  }
  return tips.slice(0, 4);
}
