// HomeLedger views — one render function per page, plus the event wiring
// that makes every control on the page actually work.

import {
  formatMoney, formatDate, monthLabel, currentMonthKey,
  sumByType, spendByCategory, monthSummary, lastMonths, budgetStatus,
  savingTips, addTransaction, updateTransaction, deleteTransaction,
  setBudget, addToGoal, addGoal,
} from './state.js';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, ALL_CATEGORIES } from './data.js';
import { drawMonthlyBars, drawCategoryDonut } from './charts.js';

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function categoryOptions(selected, categories) {
  return categories.map((c) => `<option value="${esc(c)}"${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
}

function txRow(tx) {
  const sign = tx.type === 'income' ? '+' : '−';
  const cls = tx.type === 'income' ? 'pos' : 'neg';
  return `<li>
    <span class="tx-date">${esc(formatDate(tx.date))}</span>
    <span class="tx-desc">${esc(tx.description)}<span class="cat">${esc(tx.category)}</span></span>
    <span class="tx-amt money ${cls}">${sign}${formatMoney(tx.amount)}</span>
    <span>
      <button class="btn ghost" data-edit-tx="${esc(tx.id)}" type="button">Edit</button>
      <button class="btn danger" data-delete-tx="${esc(tx.id)}" type="button">Delete</button>
    </span>
  </li>`;
}

let editingId = null;
let txFilterCategory = 'All';
let txSearch = '';
let reportMonth = currentMonthKey();

// --- Dashboard ------------------------------------------------------------

export function renderDashboard(state) {
  const key = currentMonthKey();
  const s = monthSummary(state, key);
  const months = lastMonths(6).map((m) => ({
    label: m.label,
    income: sumByType(state.transactions, 'income', m.key),
    spent: sumByType(state.transactions, 'expense', m.key),
  }));
  const recent = [...state.transactions]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);
  const budgets = budgetStatus(state, key);
  const over = budgets.filter((b) => b.status === 'over');
  const near = budgets.filter((b) => b.status === 'near');

  return `
  <div class="page-head">
    <h1>Your month at a glance</h1>
    <p>${esc(monthLabel(key))} — income, spending and what is left, for the Alvarez household.</p>
  </div>
  ${over.length ? `<div class="notice warn">Over budget: ${over.map((b) => esc(b.category)).join(', ')}. Take a look at the <a href="#/budgets">Budgets</a> page.</div>` : ''}
  ${!over.length && near.length ? `<div class="notice warn">Getting close to the limit: ${near.map((b) => `${esc(b.category)} (${Math.round(b.pct)}%)`).join(', ')}.</div>` : ''}
  <section class="grid-4" aria-label="This month's summary">
    <div class="card"><div class="stat-label">Income</div><div class="stat-value in">${formatMoney(s.income)}</div><div class="stat-sub">earned in ${esc(monthLabel(key))}</div></div>
    <div class="card"><div class="stat-label">Spent</div><div class="stat-value out">${formatMoney(s.spent)}</div><div class="stat-sub">across ${s.topCategories.length} categories</div></div>
    <div class="card"><div class="stat-label">Left over</div><div class="stat-value">${formatMoney(s.left)}</div><div class="stat-sub">${s.left >= 0 ? 'ready to save or spend' : 'more went out than came in'}</div></div>
    <div class="card"><div class="stat-label">Savings rate</div><div class="stat-value">${s.savingsRate.toFixed(0)}%</div><div class="stat-sub">of income kept this month</div></div>
  </section>
  <section class="grid-2">
    <div class="card">
      <h2>Income vs spending — last 6 months</h2>
      <canvas class="chart" id="month-chart" data-height="260" role="img" aria-label="Bar chart of monthly income and spending"></canvas>
      <div class="legend"><span><span class="swatch" style="background:#2e7d32"></span>Income</span><span><span class="swatch" style="background:#b3402e"></span>Spending</span></div>
    </div>
    <div class="card">
      <h2>Top spending categories</h2>
      ${s.topCategories.slice(0, 5).map((c, i) => {
        const pct = s.spent > 0 ? (c.amount / s.spent) * 100 : 0;
        return `<div style="margin-bottom:0.7rem">
          <div class="bar-row"><span>${i + 1}. ${esc(c.category)}</span><b>${formatMoney(c.amount)} · ${pct.toFixed(0)}%</b></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, pct)}%"></div></div>
        </div>`;
      }).join('') || '<p class="empty">No spending this month yet.</p>'}
      <p class="muted">Housing is usually the biggest slice — the <a href="#/reports">Reports</a> page breaks it all down.</p>
    </div>
  </section>
  <section class="card">
    <h2>Latest transactions</h2>
    <ul class="tx-list">${recent.map(txRow).join('')}</ul>
    <p style="margin-top:0.8rem"><a class="btn" href="#/transactions">See all transactions</a></p>
  </section>`;
}

function drawDashboard(state) {
  const months = lastMonths(6).map((m) => ({
    label: m.label,
    income: sumByType(state.transactions, 'income', m.key),
    spent: sumByType(state.transactions, 'expense', m.key),
  }));
  const canvas = document.getElementById('month-chart');
  if (canvas) drawMonthlyBars(canvas, months);
}

// --- Transactions ---------------------------------------------------------

export function renderTransactions(state) {
  const txs = [...state.transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const filtered = txs.filter((t) => {
    if (txFilterCategory !== 'All' && t.category !== txFilterCategory) return false;
    if (txSearch && !`${t.description} ${t.category}`.toLowerCase().includes(txSearch.toLowerCase())) return false;
    return true;
  });
  const editing = editingId ? state.transactions.find((t) => t.id === editingId) : null;
  const today = new Date().toISOString().slice(0, 10);

  return `
  <div class="page-head">
    <h1>Transactions</h1>
    <p>Every dollar in and out. Add a new one, fix a mistake, or find an old purchase.</p>
  </div>
  <section class="grid-2">
    <div class="card">
      <h2>${editing ? 'Edit transaction' : 'Add a transaction'}</h2>
      <form id="tx-form">
        <div class="type-toggle" role="group" aria-label="Transaction type">
          <button type="button" class="inc" data-tx-type="income" aria-pressed="${editing ? String(editing.type === 'income') : 'false'}">+ Income</button>
          <button type="button" class="exp" data-tx-type="expense" aria-pressed="${editing ? String(editing.type === 'expense') : 'true'}">− Expense</button>
        </div>
        <input type="hidden" id="tx-type" value="${editing ? editing.type : 'expense'}">
        <div class="form-row">
          <div class="field"><label for="tx-date">Date</label><input type="date" id="tx-date" required value="${editing ? esc(editing.date) : today}"></div>
          <div class="field"><label for="tx-amount">Amount ($)</label><input type="number" id="tx-amount" min="0.01" step="0.01" required value="${editing ? editing.amount : ''}" placeholder="0.00"></div>
        </div>
        <div class="field"><label for="tx-desc">Description</label><input type="text" id="tx-desc" required maxlength="120" value="${editing ? esc(editing.description) : ''}" placeholder="e.g. Weekly shop — Green Mart"></div>
        <div class="field"><label for="tx-cat">Category</label><select id="tx-cat">${categoryOptions(editing ? editing.category : 'Groceries', ALL_CATEGORIES)}</select></div>
        <div class="btn-row">
          <button class="btn amber" type="submit">${editing ? 'Save changes' : 'Add transaction'}</button>
          ${editing ? '<button class="btn ghost" type="button" id="tx-cancel">Cancel edit</button>' : ''}
        </div>
      </form>
    </div>
    <div class="card">
      <h2>Find transactions</h2>
      <div class="toolbar">
        <div class="field"><label for="tx-filter-cat">Category</label>
          <select id="tx-filter-cat"><option>All</option>${categoryOptions(txFilterCategory === 'All' ? '' : txFilterCategory, ALL_CATEGORIES)}</select></div>
        <div class="field"><label for="tx-search">Search</label>
          <input type="search" id="tx-search" placeholder="Search description…" value="${esc(txSearch)}"></div>
      </div>
      <p class="muted">${filtered.length} of ${txs.length} transactions shown. Totals: <span class="pos">+${formatMoney(sumByType(filtered, 'income'))}</span> in, <span class="neg">−${formatMoney(sumByType(filtered, 'expense'))}</span> out.</p>
      <p class="muted">Your data is stored in this browser only. Use the reset link in the footer of the Reports page to restore the sample household.</p>
    </div>
  </section>
  <section class="card">
    <h2>All transactions</h2>
    ${filtered.length ? `<ul class="tx-list">${filtered.map(txRow).join('')}</ul>` : '<p class="empty">Nothing matches those filters yet — try clearing the search.</p>'}
  </section>`;
}

// --- Budgets --------------------------------------------------------------

export function renderBudgets(state) {
  const key = currentMonthKey();
  const rows = budgetStatus(state, key);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalUsed = rows.reduce((s, r) => s + r.used, 0);

  return `
  <div class="page-head">
    <h1>Monthly budgets</h1>
    <p>Set a monthly limit for each category and watch spending against it. ${esc(monthLabel(key))} so far: ${formatMoney(totalUsed)} of ${formatMoney(totalLimit)} budgeted.</p>
  </div>
  <section class="card">
    <h2>Where the month stands</h2>
    ${rows.map((r) => `
      <div style="margin-bottom:1rem">
        <div class="bar-row">
          <span><b>${esc(r.category)}</b> ${r.status === 'over' ? '<span class="pill over">Over budget</span>' : r.status === 'near' ? '<span class="pill warn">Almost there</span>' : '<span class="pill ok">On track</span>'}</span>
          <span><b>${formatMoney(r.used)}</b> of ${formatMoney(r.limit)} ${r.left >= 0 ? `· ${formatMoney(r.left)} left` : `· ${formatMoney(-r.left)} over`}</span>
        </div>
        <div class="bar-track"><div class="bar-fill ${r.status === 'over' ? 'over' : r.status === 'near' ? 'warn' : ''}" style="width:${Math.min(100, r.pct)}%"></div></div>
        <form class="budget-form" data-category="${esc(r.category)}" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
          <label class="small" for="budget-${esc(r.category)}">Monthly limit ($)</label>
          <input type="number" id="budget-${esc(r.category)}" name="limit" min="0" step="1" value="${r.limit}" style="max-width:9rem">
          <button class="btn ghost" type="submit">Update budget</button>
        </form>
      </div>`).join('')}
  </section>
  <section class="callout">
    <h2>How to use budgets that stick</h2>
    <p>Give every category a limit before the month starts, check in weekly, and move money between categories instead of breaking the total. A budget that is 80% used with a week left is a warning, not a failure — shift the next grocery run, not the goal.</p>
  </section>`;
}

// --- Goals -----------------------------------------------------------------

export function renderGoals(state) {
  const totalSaved = state.goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = state.goals.reduce((s, g) => s + g.target, 0);

  return `
  <div class="page-head">
    <h1>Savings goals</h1>
    <p>${formatMoney(totalSaved)} saved toward ${formatMoney(totalTarget)} in goals. Small, regular contributions beat occasional big ones.</p>
  </div>
  <section class="grid-3">
    ${state.goals.map((g) => {
      const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
      const remaining = Math.max(0, g.target - g.saved);
      return `<div class="card">
        <h2>${esc(g.name)}</h2>
        <p class="muted">${esc(g.note || '')}</p>
        <div class="bar-row"><span><b>${formatMoney(g.saved)}</b> saved</span><span>of ${formatMoney(g.target)}</span></div>
        <div class="bar-track"><div class="bar-fill goal" style="width:${Math.min(100, pct)}%"></div></div>
        <p class="small">${pct.toFixed(0)}% funded · ${remaining > 0 ? `${formatMoney(remaining)} to go` : 'Goal reached — well done!'}</p>
        <form class="goal-form" data-goal="${esc(g.id)}" style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <label class="small" for="contrib-${esc(g.id)}">Add ($)</label>
          <input type="number" id="contrib-${esc(g.id)}" name="amount" min="1" step="1" placeholder="50" required style="max-width:7rem">
          <button class="btn amber" type="submit">Contribute</button>
        </form>
      </div>`;
    }).join('')}
  </section>
  <section class="card">
    <h2>Start a new goal</h2>
    <form id="goal-new" class="form-row" style="align-items:end">
      <div class="field"><label for="goal-name">Goal name</label><input type="text" id="goal-name" required maxlength="60" placeholder="e.g. New washing machine"></div>
      <div class="field"><label for="goal-target">Target amount ($)</label><input type="number" id="goal-target" min="1" step="1" required placeholder="1000"></div>
      <div class="field"><button class="btn" type="submit">Create goal</button></div>
    </form>
  </section>`;
}

// --- Reports ---------------------------------------------------------------

export function renderReports(state) {
  const months = lastMonths(6);
  const s = monthSummary(state, reportMonth);
  const byCat = spendByCategory(state.transactions, reportMonth);
  const slices = Object.entries(byCat)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const tips = savingTips(state, reportMonth);

  return `
  <div class="page-head">
    <h1>Reports</h1>
    <p>Month-by-month totals, where the money went, and tips based on your own spending.</p>
  </div>
  <section class="card">
    <div class="toolbar" style="margin-bottom:0.4rem">
      <div class="field"><label for="report-month">Month</label>
        <select id="report-month">${months.map((m) => `<option value="${m.key}"${m.key === reportMonth ? ' selected' : ''}>${esc(monthLabel(m.key))}</option>`).join('')}</select>
      </div>
    </div>
    <div class="grid-3">
      <div><div class="stat-label">Income</div><div class="stat-value in">${formatMoney(s.income)}</div></div>
      <div><div class="stat-label">Spending</div><div class="stat-value out">${formatMoney(s.spent)}</div></div>
      <div><div class="stat-label">Saved</div><div class="stat-value">${formatMoney(s.left)}</div><div class="stat-sub">${s.savingsRate.toFixed(0)}% savings rate</div></div>
    </div>
  </section>
  <section class="grid-2">
    <div class="card">
      <h2>Spending by category — ${esc(monthLabel(reportMonth))}</h2>
      <canvas class="chart" id="donut-chart" data-height="280" role="img" aria-label="Donut chart of spending by category"></canvas>
      <table style="margin-top:0.6rem">
        <thead><tr><th>Category</th><th class="num">Amount</th><th class="num">Share</th></tr></thead>
        <tbody>${slices.map((c, i) => `<tr><td><span class="swatch" style="display:inline-block;width:0.8rem;height:0.8rem;border-radius:0.2rem;margin-right:0.4rem;background:${['#1f4d43', '#c98a1b', '#2e7d6b', '#b3402e', '#7a9e7e', '#8a6d3b', '#5b7fa6', '#a65b7a', '#6b7f8a', '#d9a441'][i % 10]}"></span>${esc(c.category)}</td><td class="num money">${formatMoney(c.amount)}</td><td class="num">${s.spent > 0 ? ((c.amount / s.spent) * 100).toFixed(0) : 0}%</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="card">
      <h2>Tips from your own numbers</h2>
      ${tips.map((t) => `<div class="tip"><b>${esc(t.title)}</b><p style="margin:0.25rem 0 0">${esc(t.body)}</p></div>`).join('')}
      <h3 style="margin-top:1.1rem">Last 6 months</h3>
      <table>
        <thead><tr><th>Month</th><th class="num">Income</th><th class="num">Spent</th><th class="num">Saved</th></tr></thead>
        <tbody>${months.map((m) => {
          const inc = sumByType(state.transactions, 'income', m.key);
          const sp = sumByType(state.transactions, 'expense', m.key);
          return `<tr><td>${esc(monthLabel(m.key))}</td><td class="num money pos">${formatMoney(inc)}</td><td class="num money neg">${formatMoney(sp)}</td><td class="num money">${formatMoney(inc - sp)}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>
  </section>
  <section class="card">
    <h2>Start over</h2>
    <p class="muted">Restore the sample Alvarez household data, wiping your changes on this device.</p>
    <button class="btn danger" type="button" id="reset-data">Reset to sample data</button>
  </section>`;
}

function drawReports(state) {
  const byCat = spendByCategory(state.transactions, reportMonth);
  const slices = Object.entries(byCat)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const canvas = document.getElementById('donut-chart');
  if (canvas) drawCategoryDonut(canvas, slices);
}

// --- wiring ---------------------------------------------------------------

function markActiveNav(route) {
  document.querySelectorAll('.main-nav a').forEach((a) => {
    a.classList.toggle('active', (a.dataset.route || '') === route);
  });
}

export function mount(route, state, rerender) {
  markActiveNav(route);
  if (route === '') drawDashboard(state);
  if (route === 'reports') drawReports(state);

  // Transaction form: add or save an edit.
  const form = document.getElementById('tx-form');
  if (form) {
    const typeButtons = form.querySelectorAll('[data-tx-type]');
    typeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('tx-type').value = btn.dataset.txType;
        typeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        const cat = document.getElementById('tx-cat');
        const list = btn.dataset.txType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        const current = cat.value;
        cat.innerHTML = categoryOptions(list.includes(current) ? current : list[0], list);
      });
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const tx = {
        date: document.getElementById('tx-date').value,
        type: document.getElementById('tx-type').value,
        category: document.getElementById('tx-cat').value,
        description: document.getElementById('tx-desc').value,
        amount: document.getElementById('tx-amount').value,
      };
      if (!tx.date || !tx.description.trim() || !(Number(tx.amount) > 0)) return;
      if (editingId) {
        updateTransaction(state, editingId, tx);
        editingId = null;
      } else {
        addTransaction(state, tx);
      }
      rerender();
    });
    const cancel = document.getElementById('tx-cancel');
    if (cancel) cancel.addEventListener('click', () => { editingId = null; rerender(); });
  }

  // Filters on the transactions page.
  const filterCat = document.getElementById('tx-filter-cat');
  if (filterCat) filterCat.addEventListener('change', () => { txFilterCategory = filterCat.value; rerender(); });
  const search = document.getElementById('tx-search');
  if (search) search.addEventListener('input', () => { txSearch = search.value; rerender(); });

  // Edit / delete buttons in every transaction list.
  document.querySelectorAll('[data-edit-tx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingId = btn.dataset.editTx;
      if (route !== 'transactions') location.hash = '#/transactions';
      rerender();
      document.getElementById('tx-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.querySelectorAll('[data-delete-tx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (window.confirm('Delete this transaction?')) {
        deleteTransaction(state, btn.dataset.deleteTx);
        rerender();
      }
    });
  });

  // Budget forms.
  document.querySelectorAll('.budget-form').forEach((f) => {
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = f.querySelector('input[name="limit"]');
      if (input && Number(input.value) >= 0) {
        setBudget(state, f.dataset.category, input.value);
        rerender();
      }
    });
  });

  // Goal contributions and new goals.
  document.querySelectorAll('.goal-form').forEach((f) => {
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const input = f.querySelector('input[name="amount"]');
      if (input && Number(input.value) > 0) {
        addToGoal(state, f.dataset.goal, input.value);
        rerender();
      }
    });
  });
  const goalNew = document.getElementById('goal-new');
  if (goalNew) {
    goalNew.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = document.getElementById('goal-name').value;
      const target = document.getElementById('goal-target').value;
      if (name.trim() && Number(target) > 0) {
        addGoal(state, name, target);
        rerender();
      }
    });
  }

  // Report month picker and data reset.
  const reportMonthSel = document.getElementById('report-month');
  if (reportMonthSel) {
    reportMonthSel.addEventListener('change', () => { reportMonth = reportMonthSel.value; rerender(); });
  }
  const resetBtn = document.getElementById('reset-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (window.confirm('Reset all data to the sample household? Your changes will be lost.')) {
        localStorage.removeItem('homeledger.v1');
        location.reload();
      }
    });
  }
}
