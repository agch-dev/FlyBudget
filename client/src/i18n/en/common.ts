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
  /** Why an uploaded logo (account or payee) could not be used */
  image: {
    notImage: 'Please choose an image file.',
    couldNotProcess: 'Could not process image.',
    couldNotRead: 'Could not read that image.',
  },
  /** The Payees page and the payee icon */
  payees: {
    title: 'Payees',
    loading: 'Loading...',
    search: 'Search payees…',
    noMatch: 'No payees match your search.',
    emptyTitle: 'No payees yet',
    emptyDescription:
      'Payees are the people and businesses you pay or get paid by. They’re added automatically as you enter or import transactions, and you can give each one a default category.',
    addTransaction: 'Add a transaction',
    list: 'Payees',
    selectAllPayees: 'Select all payees',
    selectAll: 'Select all',
    select: 'Select {{name}}',
    rename: 'Rename',
    renameNamed: 'Rename {{name}}',
    doubleClickRename: 'Double-click to rename',
    actionsFor: 'Actions for {{name}}',
    delete: 'Delete',
    deleteNamed: 'Delete {{name}}',
    name: 'Name',
    defaultCategory: 'Default category',
    defaultCategoryFor: 'Default category for {{name}}',
    noDefaultCategory: 'No default category',
    noDefault: 'No default',
    transactions: 'Transactions',
    transactionCount_one: '{{count}} transaction',
    transactionCount_other: '{{count}} transactions',
    /** `total` is two or more */
    mergeSelected: 'Merge {{total}} payees',
    mergeTitle: 'Merge Payees',
    mergeIntro:
      'Choose which payee name to keep. All transactions will be moved to the selected payee.',
    merge: 'Merge',
    deleteTitle: 'Delete Payee',
    deleteMessage: 'Delete "{{name}}"? This will remove the payee from all their transactions.',
    changeImage: 'Change image for {{name}}',
    uploadImage: 'Upload an image for {{name}}',
    removeImage: 'Remove image for {{name}}',
    useInitial: 'Use initial instead',
    imageError: 'Could not use that image.',
  },
  /** The Cash Flow page */
  cashFlow: {
    title: 'Cash Flow',
    preset: {
      '1m': '1M',
      '3m': '3M',
      '6m': '6M',
      ytd: 'This Year',
      'last-year': 'Last Year',
      custom: 'Custom',
    },
    exportCsv: 'Export CSV',
    totalIncome: 'Total income',
    totalExpenses: 'Total expenses',
    netIncome: 'Total net income',
    savingsRate: 'Savings rate',
    showAs: 'Show as',
    list: 'List',
    diagram: 'Diagram',
    swipe: 'Swipe to see it all',
    transactionsOf: 'Transactions: {{name}}',
    clear: 'Clear',
    /** The names the diagram gives to what has no name of its own */
    node: {
      income: 'Income',
      totalIncome: 'Total Income',
      savings: 'Savings',
      uncategorized: 'Uncategorized',
    },
    emptyMessage: 'No data for this period',
    emptyHint: 'Add transactions, or pick a longer date range.',
    negativeFlows:
      'Some flows excluded — Sankey diagrams cannot represent negative values (e.g. refunds). Summary totals may differ slightly.',
    ofTotalIncome: '{{percent}}% of total income',
    ofTotalSpending: '{{percent}}% of total spending',
    ofGroup: '{{percent}}% of {{group}}',
    savingsRatePercent: '{{percent}}% savings rate',
    moneyIn: 'Money in',
    whereItWent: 'Where it went',
    saved: 'Saved',
    /** `share` is a percentage with its sign; the rest is for screen readers */
    shareOfIncome: '{{share}}<hidden> of income</hidden>',
    hideTransactions: 'Hide transactions',
    allGroupTransactions: 'All {{group}} transactions',
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
    done: 'Done',
  },
  /** The month range picker (Cash Flow's custom range) */
  monthRange: {
    previousYear: 'Previous year',
    nextYear: 'Next year',
    from: 'From',
    to: 'To',
  },
  undo: {
    undid: 'Undid: {{message}}',
    redid: 'Redid: {{message}}',
    undo: 'Undo',
    redo: 'Redo',
    dismiss: 'Dismiss',
    /** What a change was, in "Undid: …" (accounts and reports name theirs in their own catalogs) */
    action: {
      createTransaction: 'Create transaction',
      editTransaction: 'Edit transaction',
      deleteTransaction: 'Delete transaction',
      createTransfer: 'Create transfer',
      linkTransfer: 'Link as transfer',
      unlinkTransfer: 'Unlink transfer',
      createGroup: 'Create group "{{name}}"',
      renameGroup: 'Rename group',
      deleteGroup: 'Delete group "{{name}}"',
      reorderGroups: 'Reorder groups',
      createCategory: 'Create category "{{name}}"',
      editCategory: 'Edit category',
      reorderCategories: 'Reorder categories',
      setBudget: 'Set budget',
      createRule: 'Create rule',
      enableRule: 'Enable rule',
      disableRule: 'Disable rule',
      editRule: 'Edit rule',
      deleteRule: 'Delete rule',
      reorderRules: 'Reorder rules',
      createSchedule: 'Create schedule "{{name}}"',
      editSchedule: 'Edit schedule',
      cancelSchedule: 'Cancel schedule "{{name}}"',
      markPaid: 'Mark as paid',
      createGoal: 'Create goal "{{name}}"',
      editGoal: 'Edit goal',
      deleteGoal: 'Delete goal "{{name}}"',
      createPayee: 'Create payee "{{name}}"',
      editPayee: 'Edit payee',
      deletePayee: 'Delete payee "{{name}}"',
    },
  },
  viewingCurrency: {
    label: 'Viewing currency',
    hint: 'Show totals in pesos or in dollars. The Budget is always in pesos.',
  },
  dateFormat: {
    title: 'Date Format',
  },
  /**
   * Every date the app writes, as date-fns patterns: `format(day, t('datePattern.long'))`.
   * Month and weekday names follow the language on their own; the order of day and month
   * (and the Spanish "de") is what differs.
   */
  datePattern: {
    /** "October 5, 2026": the register's day headings */
    long: 'MMMM d, yyyy',
    /** "Oct 5, 2026": a day inside a sentence or a list */
    medium: 'MMM d, yyyy',
    /** "Oct 5": a day of the current period */
    dayMonth: 'MMM d',
    /** "Oct 5 '26": a chart's day axis across years */
    dayMonthShortYear: "MMM d ''yy",
    /** "Monday, October 5" */
    weekdayDayMonth: 'EEEE, MMMM d',
    /** "Mon, Oct 5, 2026" */
    weekdayDate: 'EEE, MMM d, yyyy',
    /** "Monday, October 5, 2026" */
    weekdayLongDate: 'EEEE, MMMM d, yyyy',
    /** "Mon 5 Oct 2026": a day in Settings → Exchange rates */
    ratesDay: 'EEE d MMM yyyy',
    /** "October 2026": a month's heading */
    monthYear: 'MMMM yyyy',
    /** "Oct 2026": a month inside a sentence, a range or a picker */
    shortMonthYear: 'MMM yyyy',
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
