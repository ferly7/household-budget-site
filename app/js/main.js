// HomeLedger entry point — hash router and first render.
// Routes: #/ dashboard, #/transactions, #/budgets, #/goals, #/reports.
// An unknown hash falls back to the dashboard.

import { loadState } from './state.js';
import {
  renderDashboard, renderTransactions, renderBudgets, renderGoals,
  renderReports, mount,
} from './views.js';

const app = document.getElementById('app');
const state = loadState();

const PAGES = {
  '': renderDashboard,
  transactions: renderTransactions,
  budgets: renderBudgets,
  goals: renderGoals,
  reports: renderReports,
};

function currentRoute() {
  const hash = window.location.hash || '#/';
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  return Object.prototype.hasOwnProperty.call(PAGES, path) ? path : '';
}

function render() {
  const route = currentRoute();
  app.innerHTML = PAGES[route](state);
  mount(route, state, render);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
