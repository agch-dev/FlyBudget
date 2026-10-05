import type { BudgetType } from '../../types';

// The Budget page, a category page and planned amounts.
export default {
  nav: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    today: 'Today',
  },
  columns: {
    planned: 'Planned',
    actual: 'Actual',
    remaining: 'Remaining',
  },
  sections: {
    income: 'Income',
    expenses: 'Expenses',
    totalIncome: 'Total Income',
    totalExpenses: 'Total Expenses',
  },
  /** The sections expenses are listed in, keyed by `BudgetType` */
  /** The one label of each budget type, wherever it shows (budget, dashboard, category picker) */
  budgetType: {
    fixed: 'Fixed',
    flexible: 'Flexible',
    non_monthly: 'Non-Monthly',
    savings: 'Savings/Investments',
  } satisfies Record<BudgetType, string>,
  /** The accessible name of a category's planned amount: while editing, and as a button */
  plannedFor: 'Planned for {{category}}',
  plannedForAmount: 'Planned for {{category}}: {{amount}}',
  inactive: {
    show_one: 'Show {{count}} inactive category',
    show_other: 'Show {{count}} inactive categories',
    hide_one: 'Hide {{count}} inactive category',
    hide_other: 'Hide {{count}} inactive categories',
  },
  /** `month` is a month's name, like "October" */
  nothingPlanned: {
    click:
      "Nothing is planned for {{month}} yet. Click an amount in the <strong>Planned</strong> column to set what you expect to earn and spend in each category. Categories you leave empty are tucked away once you've planned something. <guide>How budgeting works</guide>",
    tap: "Nothing is planned for {{month}} yet. Tap an amount in the <strong>Planned</strong> column to set what you expect to earn and spend in each category. Categories you leave empty are tucked away once you've planned something. <guide>How budgeting works</guide>",
  },
  noCategories: 'No categories yet. <settings>Add some in Settings</settings>',
  summary: {
    toBeBudgeted: 'To be budgeted',
    status: {
      over: 'Over budget',
      full: 'Fully budgeted',
      almost: 'Almost budgeted',
      left: 'Left to budget',
    },
    tabs: {
      summary: 'Summary',
      income: 'Income',
      expenses: 'Expenses',
    },
    income: 'Income',
    expenses: 'Expenses',
    saveUp: 'Save up',
    fixed: 'Fixed',
    flexible: 'Flexible',
    nonMonthly: 'Non-Monthly',
    planned: '{{amount}} planned',
    earned: 'earned',
    spent: 'spent',
    contributed: 'contributed',
    remaining: 'remaining',
  },
  history: {
    title: 'History',
    earnedLastMonth: 'Earned last month',
    spentLastMonth: 'Spent last month',
    monthlyAverage: 'Monthly average',
    none: 'No history available',
    applyToFuture: 'Apply {{amount}} to all future months',
  },
  /** Planning an amount on a phone */
  sheet: {
    title: 'Plan {{category}}',
    titlePlain: 'Plan',
    nextTwelveMonths: 'Use this amount for the next 12 months',
    save: 'Save',
  },
  phone: {
    /** A section's header: what came in or went out, of what was planned */
    actualOfPlanned: '{{actual}} of {{planned}}',
    remaining: '{{amount}} remaining',
    received: 'Received',
    spent: 'Spent',
  },
  category: {
    /** Stands in for the category's name while it loads */
    fallbackName: 'Category',
    spendingHistory: 'Spending History',
    budget: 'Budget',
    summary: {
      title: 'Summary',
      noData: 'No data',
      count: 'Total transactions',
      largest: 'Largest transaction',
      average: 'Average transaction',
      totalIncome: 'Total income',
      totalSpending: 'Total spending',
      first: 'First transaction',
      last: 'Last transaction',
    },
  },
} as const;
