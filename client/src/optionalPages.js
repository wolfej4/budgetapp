// Pages the user can hide from navigation (Dashboard and Settings are always shown)
export const OPTIONAL_PAGES = [
  { path: '/bills', label: 'Bills' },
  { path: '/split-payments', label: 'Split Payments' },
  { path: '/loans', label: 'Loans' },
  { path: '/budgets', label: 'Budgets' },
  { path: '/transactions', label: 'Transactions' },
  { path: '/savings-goals', label: 'Savings' },
  { path: '/subscriptions', label: 'Subscriptions' },
  { path: '/reports', label: 'Reports' },
];

export function readHiddenPages() {
  try {
    return JSON.parse(localStorage.getItem('hiddenPages') || '[]');
  } catch {
    return [];
  }
}

export function writeHiddenPages(hidden) {
  localStorage.setItem('hiddenPages', JSON.stringify(hidden));
  window.dispatchEvent(new CustomEvent('hidden-pages-changed', { detail: hidden }));
}
