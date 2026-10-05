import type { Currency } from '../../types';

// What every page shares: the sidebar, the banners, the shared `ui/` components.
export default {
  language: {
    title: 'App language',
    description: 'The language of the app on this device.',
  },
  /** Currency names, keyed by `Currency` */
  currency: {
    UYU: 'Pesos',
    USD: 'Dollars',
  } satisfies Record<Currency, string>,
  nav: {
    dashboard: 'Dashboard',
    accounts: 'Accounts',
    transactions: 'Transactions',
    budget: 'Budget',
    recurring: 'Recurring',
    reports: 'Reports',
    cashFlow: 'Cash Flow',
    goals: 'Goals',
    payees: 'Payees',
    rules: 'Rules',
    settings: 'Settings',
  },
  sidebar: {
    help: 'Help & docs',
    helpNewTab: 'Help & docs (opens in a new tab)',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    pin: 'Pin sidebar',
    unpin: 'Unpin sidebar',
    allAccounts: 'All accounts',
    forBudget: 'For budget',
    offBudget: 'Off budget',
    noAccounts: 'No accounts yet',
    addAccount: 'Add account',
    addManualAccount: 'Add Manual Account',
    connectPlaid: 'Connect via Plaid',
    connectSimplefin: 'Connect via SimpleFIN',
    groupIncomplete: 'Balances in the other currency are left out: no exchange rate yet',
  },
  ui: {
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    actions: 'Actions',
    learnMore: 'Learn more',
    opensInNewTab: '(opens in a new tab)',
  },
  undo: {
    undid: 'Undid: {{message}}',
    redid: 'Redid: {{message}}',
    undo: 'Undo',
    redo: 'Redo',
    dismiss: 'Dismiss',
  },
  viewingCurrency: {
    label: 'Viewing currency',
    hint: 'Show totals in pesos or in dollars. The Budget is always in pesos.',
  },
  dateFormat: {
    title: 'Date Format',
  },
  help: {
    newHere: 'New to FlyBudget?',
    guide: 'Read the guide',
    source: 'Source on GitHub',
    report: 'Report a problem or suggest an idea',
  },
  demo: {
    label: 'Demo',
    title: 'This is a demo budget.',
    nothingSaved: 'Nothing is saved.',
    detail: 'Change anything you like. Nothing is saved, and closing the tab starts it fresh.',
    backHome: 'Back to home',
    backHomeHint: 'Back to the FlyBudget homepage',
    startOver: 'Start over',
    startOverHint: 'Start over with the original demo budget',
    download: 'Download',
    downloadApp: 'Download FlyBudget',
    notAvailable: 'Not available in the demo',
    noBanks:
      "Bank connections need the FlyBudget app, so the demo can't connect a bank or take bank credentials. In the app, Plaid or SimpleFIN brings in your transactions automatically, and you can also import CSV files from your bank.",
    connectBank: 'Connect a bank',
  },
  rates: {
    label: 'Estimated exchange rates',
    enter: 'Enter rates',
    notCountedTitle: 'No exchange rate stored yet.',
    notCountedDetail:
      'Totals in pesos leave dollar amounts out, and totals in dollars leave pesos out, until there is one.',
    missingTitle: 'No exchange rate for {{dates}}.',
    missingDetail_one:
      'Dollar amounts on that date are converted at the closest rate available, so totals are estimated.',
    missingDetail_other:
      'Dollar amounts on those dates are converted at the closest rate available, so totals are estimated.',
    /** "1 Feb 2023 and 10 Nov 2023": `dates` is one date or several joined with commas */
    datesAnd: '{{dates}} and {{last}}',
    datesRange: '{{total}} dates from {{first}} to {{last}}',
  },
  errors: {
    invalidValues: 'Some of the values entered are invalid',
  },
} as const;
