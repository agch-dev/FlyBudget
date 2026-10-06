// Keep in sync with server/src/utils/accountTypes.ts
export type AccountType =
  | 'checking'
  | 'savings'
  | 'cash'
  | 'credit'
  | 'line_of_credit'
  | 'investment'
  | 'retirement'
  | 'crypto'
  | 'real_estate'
  | 'vehicle'
  | 'valuables'
  | 'mortgage'
  | 'auto_loan'
  | 'student_loan'
  | 'loan'
  | 'other_asset'
  | 'other_liability';

export type AccountTypeGroup = 'cash' | 'credit' | 'investments' | 'property' | 'loans' | 'other';

export interface AccountTypeInfo {
  value: AccountType;
  group: AccountTypeGroup;
  /** Debts: the balance is what's owed, stored as a negative number */
  liability: boolean;
  /** Everyday spending accounts; the rest default to off budget */
  onBudget: boolean;
}

export const ACCOUNT_TYPES: AccountTypeInfo[] = [
  {
    value: 'checking',
    group: 'cash',
    liability: false,
    onBudget: true,
  },
  {
    value: 'savings',
    group: 'cash',
    liability: false,
    onBudget: true,
  },
  {
    value: 'cash',
    group: 'cash',
    liability: false,
    onBudget: true,
  },
  {
    value: 'credit',
    group: 'credit',
    liability: true,
    onBudget: true,
  },
  {
    value: 'line_of_credit',
    group: 'credit',
    liability: true,
    onBudget: true,
  },
  {
    value: 'investment',
    group: 'investments',
    liability: false,
    onBudget: false,
  },
  {
    value: 'retirement',
    group: 'investments',
    liability: false,
    onBudget: false,
  },
  {
    value: 'crypto',
    group: 'investments',
    liability: false,
    onBudget: false,
  },
  {
    value: 'real_estate',
    group: 'property',
    liability: false,
    onBudget: false,
  },
  {
    value: 'vehicle',
    group: 'property',
    liability: false,
    onBudget: false,
  },
  {
    value: 'valuables',
    group: 'property',
    liability: false,
    onBudget: false,
  },
  {
    value: 'mortgage',
    group: 'loans',
    liability: true,
    onBudget: false,
  },
  {
    value: 'auto_loan',
    group: 'loans',
    liability: true,
    onBudget: false,
  },
  {
    value: 'student_loan',
    group: 'loans',
    liability: true,
    onBudget: false,
  },
  {
    value: 'loan',
    group: 'loans',
    liability: true,
    onBudget: false,
  },
  {
    value: 'other_asset',
    group: 'other',
    liability: false,
    onBudget: false,
  },
  {
    value: 'other_liability',
    group: 'other',
    liability: true,
    onBudget: false,
  },
];

/**
 * The six groups of account types, in the order they are listed. Their names are in the
 * `accounts` catalog (`accountTypeGroupLabel` in utils/accountTypes.ts).
 */
export const ACCOUNT_TYPE_GROUPS: AccountTypeGroup[] = [
  'cash',
  'credit',
  'investments',
  'property',
  'loans',
  'other',
];

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  payeeId: string | null;
  payeeName: string | null;
  categoryId: string | null;
  notes: string | null;
  reconciled: number;
  transferTransactionId: string | null;
  isParent: number;
  parentTransactionId: string | null;
  importedId: string | null;
  /** Raw payee text from the bank or CSV (null for manual entries) */
  importedPayee: string | null;
  /** 1 for a balance correction; reports leave it out while it has no category */
  isAdjustment?: number;
  scheduleId: string | null;
  createdAt: string;
  children?: Transaction[];
  /** The account's currency, sent with transaction lists (closed accounts included) */
  currency?: Currency;
  /**
   * The amount in the other currency (pesos for a dollar transaction and the reverse), at
   * the exchange rate of its date. Sent with transaction lists, worked out by the server on
   * every read and never stored; null when no rate is stored. Read it with `utils/conversion.ts`
   */
  convertedAmount?: number | null;
  /**
   * For a transfer, sent with transaction lists: the other side's account, its native amount
   * there, and the rate the two amounts imply (pesos per dollar; null within one currency)
   */
  transfer?: { accountId: string; amount: number; currency: Currency; rate: number | null };
}

export interface ImportPreviewRow {
  date: string;
  amount: number;
  payeeName: string | null;
  notes: string | null;
  importedId: string;
  isDuplicate: boolean;
}

export type BudgetType = 'fixed' | 'flexible' | 'non_monthly' | 'savings';

export interface Category {
  id: string;
  groupId: string;
  name: string;
  icon: string | null;
  budgetType: BudgetType | null;
  sortOrder: number;
  createdAt: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  isIncome: number;
  sortOrder: number;
  createdAt: string;
  categories: Category[];
}

export interface Payee {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  /** Custom logo image (data URL); null = colored initials */
  logo: string | null;
  createdAt: string;
}

export interface TransactionQueryParams {
  accountId?: string;
  month?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  categoryGroupId?: string;
  categoryIds?: string[];
  search?: string;
  reconciled?: 0 | 1;
  limit?: number;
  offset?: number;
}

export interface BudgetCategory {
  id: string;
  groupId: string;
  name: string;
  icon: string | null;
  budgetType: BudgetType | null;
  sortOrder: number;
  createdAt: string;
  budgeted: number;
  spent: number;
  carryOver: number;
  balance: number;
}

export interface BudgetGroup {
  id: string;
  name: string;
  isIncome: number;
  sortOrder: number;
  createdAt: string;
  categories: BudgetCategory[];
}

export interface BudgetSummary {
  month: string;
  income: number;
  totalBudgeted: number;
  carryOver: number;
  toBeBudgeted: number;
}

// Keep in sync with CURRENCIES in server/src/utils/currency.ts
/**
 * The currencies an account can hold: Uruguayan pesos and US dollars. No others exist. Their
 * names are `currency` in the common catalog.
 */
export const CURRENCIES = [
  { value: 'UYU', symbol: '$' },
  { value: 'USD', symbol: 'US$' },
] as const;

export type Currency = (typeof CURRENCIES)[number]['value'];

/** The currency the budget is planned in and combined totals are shown in. It is fixed. */
export const HOME_CURRENCY: Currency = 'UYU';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Every amount in the account (balance, starting balance, transactions) is in it */
  currency: Currency;
  /** False while the account has no transactions */
  hasTransactions?: boolean;
  /**
   * What ties the account to its currency: its transactions, a recurring item that uses it
   * or a goal linked to it. Null when nothing does: only then can the currency change.
   */
  currencyLockedBy?: 'transactions' | 'recurring' | 'goal' | null;
  /** Its Account Group (accounts with the same name are shown together); null = none */
  groupName?: string | null;
  startingBalance: number;
  isOffBudget: number;
  sortOrder: number;
  closedAt: string | null;
  /** Custom logo image (data URL); null = colored initials */
  logo: string | null;
  createdAt: string;
  balance: number;
}

export interface NetWorthPoint {
  /** YYYY-MM, or YYYY-MM-DD for daily points */
  month: string;
  /** In the currency asked for (pesos by default), balances converted at this point's rate */
  assets: number;
  liabilities: number;
  netWorth: number;
  /** What the total is made of: each currency's own net worth in its native amount */
  native?: Record<Currency, number>;
  /** Currencies `native` lists but the totals leave out: no exchange rate to convert them */
  leftOut?: Currency[];
}
export interface IncomeExpensesPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
  /** Signed sum of expense-category transactions (negative = net spending, refunds not clamped) */
  expenseNet: number;
  /** Number of outflow transactions in expense categories */
  expenseCount: number;
}
export interface CashFlowPoint {
  month: string;
  net: number;
}
export interface SpendingByCategory {
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  groupId: string | null;
  groupName: string | null;
  totalSpent: number;
}
export interface IncomeByCategoryItem {
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  groupId: string | null;
  groupName: string | null;
  totalReceived: number;
}
export interface SpendingTrendPoint {
  categoryId: string;
  categoryName: string | null;
  categoryIcon: string | null;
  month: string;
  total: number;
}

/** One day's money in and out on budget accounts, without transfers (`GET /reports/daily-flow`) */
export interface DailyFlowPoint {
  /** yyyy-MM-dd */
  date: string;
  income: number;
  expenses: number;
  /** Transactions that day (a split counts once) */
  count: number;
}

export interface SpendingComparisonData {
  currentTotal: number;
  periodLabel: string;
  currentLabel: string;
  comparisonLabel: string;
  maxDays: number;
  todayDay: number;
  current: { day: number; cumulative: number }[];
  comparison: { day: number; cumulative: number }[];
}

// Custom Reports
export type ChartType = 'bar' | 'stacked-bar' | 'line' | 'area' | 'donut' | 'table';
export type ReportMode = 'total' | 'time';
export type ReportGroupBy = 'category' | 'categoryGroup' | 'payee' | 'account' | 'month';
export type BalanceType = 'expense' | 'income' | 'net';
export type DatePresetCustom = '1m' | '3m' | '6m' | '12m' | 'ytd' | 'last-year' | 'all' | 'custom';

/** `preset: 'custom'` is frozen to `from`/`to`; other presets are live, relative to today. */
export interface ReportDateRange {
  preset: DatePresetCustom;
  from: string;
  to: string;
}

export interface CustomReportConfig {
  chartType: ChartType;
  mode: ReportMode;
  groupBy: ReportGroupBy;
  balanceType: BalanceType;
  dateRange: ReportDateRange;
  filters: { accountIds: string[]; categoryIds: string[]; categoryGroupIds: string[] };
}

export interface SavedCustomReport {
  id: string;
  name: string;
  config: CustomReportConfig;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomReportTotalData {
  mode: 'total';
  data: { name: string; id: string | null; value: number }[];
}

export interface CustomReportTimeData {
  mode: 'time';
  groups: string[];
  data: Record<string, string | number>[];
}

export type CustomReportData = CustomReportTotalData | CustomReportTimeData;

// Report dashboards
export interface DashboardPage {
  id: string;
  name: string;
  sortOrder: number;
  /** The range this dashboard's widgets follow unless they have their own; null = last 6 months */
  dateRange: ReportDateRange | null;
  createdAt: string;
}

export type BuiltinWidgetType =
  'summary' | 'net-worth' | 'income-expenses' | 'spending' | 'spending-trends' | 'calendar';

interface WidgetBase {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
}

export interface BuiltinWidget extends WidgetBase {
  type: BuiltinWidgetType;
  customReportId: null;
  /**
   * No `dateRange` means the widget follows its dashboard's range. `categoryIds` (Spending
   * Trends only) are the categories to chart; without it, the biggest spending categories.
   */
  meta: { name?: string; dateRange?: ReportDateRange; categoryIds?: string[] };
}

export interface CustomReportWidget extends WidgetBase {
  type: 'custom-report';
  customReportId: string;
  meta: { dateRange?: ReportDateRange };
}

export type DashboardWidget = BuiltinWidget | CustomReportWidget;
export type WidgetType = DashboardWidget['type'];

// --- Rules (mirrors server/src/services/rulesEngine.ts) ---
export type RuleTextField = 'payee_name' | 'imported_payee' | 'notes';
export type RuleIdField = 'payee' | 'account' | 'category';
export type RuleConditionField =
  RuleTextField | RuleIdField | 'amount' | 'direction' | 'currency' | 'date';

export type RuleCondition =
  | {
      field: RuleTextField;
      op: 'is' | 'is_not' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex';
      value: string;
    }
  | { field: RuleTextField | RuleIdField; op: 'one_of' | 'not_one_of'; value: string[] }
  | { field: RuleTextField | RuleIdField; op: 'is_empty' | 'is_not_empty' }
  | { field: RuleIdField; op: 'is' | 'is_not'; value: string }
  /** Absolute native amount in cents; `direction` tells inflow from outflow, `currency` pesos from dollars */
  | { field: 'amount'; op: 'is' | 'is_not' | 'gt' | 'gte' | 'lt' | 'lte' | 'approx'; value: number }
  | { field: 'amount'; op: 'between'; value: [number, number] }
  | { field: 'direction'; op: 'is'; value: 'inflow' | 'outflow' }
  /** The currency of the transaction's account */
  | { field: 'currency'; op: 'is'; value: Currency }
  | { field: 'date'; op: 'is' | 'before' | 'after'; value: string }
  | { field: 'date'; op: 'between'; value: [string, string] };

export type RuleConditionOp = RuleCondition['op'];

/** The operators a condition on field `F` can have (`F` is one field, not a union) */
export type RuleOpsOf<F extends RuleConditionField, C = RuleCondition> = C extends {
  field: infer CF;
  op: infer Op;
}
  ? F extends CF
    ? Op
    : never
  : never;

export interface RuleSplitPart {
  kind: 'fixed' | 'percent' | 'remainder';
  /** cents for fixed, 0–100 for percent, unused for remainder */
  value: number;
  categoryId: string | null;
  notes: string | null;
}

export type RuleAction =
  | { type: 'set_category' | 'set_payee'; value: string }
  | { type: 'set_notes' | 'prepend_notes' | 'append_notes'; value: string }
  | { type: 'split'; parts: RuleSplitPart[] };

export interface Rule {
  id: string;
  conditionsOp: 'and' | 'or';
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

export type RuleInput = Omit<Rule, 'id' | 'createdAt' | 'sortOrder'> & { sortOrder?: number };

export interface PayeeWithCount extends Payee {
  transactionCount: number;
}

// --- Schedule System ---
export type RecurrenceType =
  | 'once'
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'yearly';
export type AmountType = 'exact' | 'approximate' | 'variable';
export type ScheduleStatus = 'active' | 'paused' | 'canceled';
export type ScheduleSource = 'manual' | 'detected';
export type WeekendAdjust = 'none' | 'before' | 'after' | 'closest';
export type OccurrenceDisplayStatus =
  'upcoming' | 'due' | 'waiting' | 'paid' | 'skipped' | 'cancelled';
export type MatchType = 'automatic' | 'manual';

export type RecurrenceRule =
  | { type: 'once' }
  | { type: 'weekly'; interval: number; anchorDay: number }
  | { type: 'biweekly'; anchorDay: number }
  | { type: 'semimonthly'; day1: number; day2: number }
  | { type: 'monthly'; interval: number; anchorDay: number }
  | { type: 'quarterly'; anchorDay: number }
  | { type: 'semiannually'; anchorDay: number }
  | { type: 'yearly'; anchorMonth: number; anchorDay: number };

/** Every frequency, in the order the form lists them (their names: `frequencyLabel`) */
export const RECURRENCE_TYPES: RecurrenceType[] = [
  'once',
  'weekly',
  'biweekly',
  'semimonthly',
  'monthly',
  'quarterly',
  'semiannually',
  'yearly',
];

export interface Schedule {
  id: string;
  name: string;
  amount: number;
  amountType: AmountType;
  recurrenceType: RecurrenceType;
  recurrenceRule: string;
  startDate: string;
  endDate: string | null;
  weekendAdjust: WeekendAdjust;
  dateFlexibility: number;
  accountId: string | null;
  transferAccountId: string | null;
  categoryId: string | null;
  payeeId: string | null;
  notes: string | null;
  status: ScheduleStatus;
  autoCreate: number;
  autoCreateFrom: string | null;
  source: ScheduleSource;
  occurrenceHorizon: string | null;
  createdAt: string;
  updatedAt: string;
  /** Its account's currency (pesos while it has no account); amounts are native amounts in it */
  currency?: Currency;
}

export interface ScheduleWithOccurrences extends Schedule {
  occurrences: ScheduleOccurrence[];
}

export interface ScheduleOccurrence {
  id: string;
  scheduleId: string;
  scheduledDate: string;
  expectedDate: string;
  expectedAmount: number;
  status: string;
  displayStatus: OccurrenceDisplayStatus;
  matchedTransactionId: string | null;
  matchType: MatchType | null;
  matchConfidence: number | null;
  skippedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  scheduleName: string;
  recurrenceType: RecurrenceType;
  amountType: AmountType;
  scheduleAccountId: string | null;
  scheduleCategoryId: string | null;
  schedulePayeeId: string | null;
  matchedAmount: number | null;
  matchedDate: string | null;
  /** The recurring item's currency: its account's, closed accounts included */
  currency?: Currency;
  /**
   * `expectedAmount` in the other currency, at the exchange rate of its date (today's while
   * that date is still to come); null or missing when it could not be converted
   */
  convertedExpectedAmount?: number | null;
  /** `matchedAmount` in the other currency, at the rate of the day it was paid */
  convertedMatchedAmount?: number | null;
}

export interface ScheduleSummary {
  income: number;
  expenses: number;
}

/** A likely recurring charge found by GET /schedules/discover (port of Actual's find-schedules). */
export interface DiscoveredSchedule {
  id: string;
  accountId: string;
  accountName: string;
  currency?: Currency;
  payeeId: string | null;
  payeeName: string;
  amount: number;
  amountType: 'exact' | 'approximate';
  recurrenceType: 'weekly' | 'biweekly' | 'monthly';
  recurrenceRule: RecurrenceRule;
  startDate: string;
  exactDate: boolean;
  categoryId: string | null;
  transactionIds: string[];
}

export interface MatchSuggestion {
  occurrenceId: string;
  scheduleId: string;
  scheduleName: string;
  scheduledDate: string;
  expectedDate: string;
  expectedAmount: number;
  /** The recurring item's currency; every candidate is in it too */
  currency?: Currency;
  candidates: {
    transactionId: string;
    date: string;
    amount: number;
    payeeName: string | null;
    score: number;
  }[];
}

export type RuleApplyScope = 'uncategorized' | 'all';

/** One transaction that running rules would change */
export interface RulePreviewItem {
  transactionId: string;
  date: string;
  accountId: string;
  currency?: Currency;
  amount: number;
  payeeName: string | null;
  changes: {
    payee?: { from: string | null; to: string | null };
    category?: { from: string | null; to: string | null };
    notes?: { from: string | null; to: string | null };
    split?: Array<{ amount: number; categoryId: string | null; notes: string | null }>;
  };
}

export interface RuleTestResult {
  count: number;
  matches: Array<{
    id: string;
    date: string;
    payeeName: string | null;
    amount: number;
    accountId: string;
    currency?: Currency;
    categoryId: string | null;
  }>;
}

// Goals
/** A goal's amounts in pesos at today's exchange rate */
export interface GoalInPesos {
  target: number;
  saved: number;
  remaining: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  accountId: string | null;
  /** The currency of the goal's amounts: its linked account's, or the one chosen without one */
  currency: Currency;
  /** For the page's summary; null for a dollar goal while no exchange rate is stored */
  inPesos?: GoalInPesos | null;
  icon: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Plaid Bank Sync
export type PlaidSyncStatus = 'good' | 'syncing' | 'error' | 'login_required';

export interface PlaidDiscoveredAccount {
  plaidAccountId: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  suggestedType: AccountType;
  currentBalance: number;
}

export interface PlaidAccountMapping {
  plaidAccountId: string;
  plaidAccountName: string;
  plaidAccountType: string;
  mask: string | null;
  accountId: string | null;
  accountName: string | null;
  isEnabled: number;
}

export interface PlaidItem {
  id: string;
  institutionName: string;
  institutionId: string;
  lastSyncedAt: string | null;
  syncStatus: PlaidSyncStatus;
  syncError: string | null;
  consentExpiresAt: string | null;
  accounts: PlaidAccountMapping[];
}

export interface PlaidExchangeResult {
  itemId: string;
  institutionName: string;
  accounts: PlaidDiscoveredAccount[];
}

export interface PlaidSyncResult {
  itemId: string;
  institutionName: string;
  added: number;
  modified: number;
  removed: number;
  errors: string[];
}

// SimpleFIN Bank Sync
export type SimplefinSyncStatus = 'good' | 'syncing' | 'error';

export interface SimplefinDiscoveredAccount {
  simplefinAccountId: string;
  name: string;
  balance: number;
  currency: string;
}

export interface SimplefinAccountMapping {
  simplefinAccountId: string;
  simplefinAccountName: string;
  accountId: string | null;
  accountName: string | null;
  isEnabled: number;
}

export interface SimplefinConnection {
  id: string;
  connectionName: string;
  lastSyncedAt: string | null;
  syncStatus: SimplefinSyncStatus;
  syncError: string | null;
  accounts: SimplefinAccountMapping[];
}

export interface SimplefinSetupResult {
  connectionId: string;
  connectionName: string;
  accounts: SimplefinDiscoveredAccount[];
}

export interface SimplefinSyncResult {
  connectionId: string;
  connectionName: string;
  added: number;
  errors: string[];
}
