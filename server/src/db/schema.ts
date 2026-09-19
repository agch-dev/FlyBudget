import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  startingBalance: integer('starting_balance').notNull().default(0),
  isOffBudget: integer('is_off_budget').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const categoryGroups = sqliteTable('category_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isIncome: integer('is_income').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => categoryGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const payees = sqliteTable('payees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultCategoryId: text('default_category_id').references(() => categories.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  amount: integer('amount').notNull(),
  payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
  payeeName: text('payee_name'),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  notes: text('notes'),
  cleared: integer('cleared').notNull().default(0),
  reconciled: integer('reconciled').notNull().default(0),
  transferTransactionId: text('transfer_transaction_id'),
  isParent: integer('is_parent').notNull().default(0),
  parentTransactionId: text('parent_transaction_id'),
  importedId: text('imported_id'),
  recurringTransactionId: text('recurring_transaction_id').references(() => recurringTransactions.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('transactions_account_date_idx').on(table.accountId, table.date),
  index('transactions_category_idx').on(table.categoryId),
  index('transactions_date_idx').on(table.date),
  index('transactions_recurring_idx').on(table.recurringTransactionId),
  index('transactions_imported_id_idx').on(table.importedId),
]);

export const budgetMonths = sqliteTable('budget_months', {
  id: text('id').primaryKey(),
  month: text('month').notNull(),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  budgeted: integer('budgeted').notNull().default(0),
  notes: text('notes'),
}, (table) => [
  uniqueIndex('budget_months_month_category_idx').on(table.month, table.categoryId),
]);

export const rules = sqliteTable('rules', {
  id: text('id').primaryKey(),
  conditions: text('conditions').notNull(),
  actions: text('actions').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const recurringTransactions = sqliteTable('recurring_transactions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  isApproximate: integer('is_approximate').notNull().default(0),
  frequency: text('frequency').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
  notes: text('notes'),
  status: text('status').notNull().default('active'),
  autoCreate: integer('auto_create').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const customReports = sqliteTable('custom_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  currentAmount: integer('current_amount').notNull().default(0),
  targetDate: text('target_date'),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  icon: text('icon').notNull().default('🎯'),
  color: text('color').notNull().default('#2563EB'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const simplefinConnections = sqliteTable('simplefin_connections', {
  id: text('id').primaryKey(),
  accessUrl: text('access_url').notNull(),
  connectionName: text('connection_name').notNull(),
  syncStatus: text('sync_status').notNull().default('good'),
  syncError: text('sync_error'),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const simplefinAccountMappings = sqliteTable('simplefin_account_mappings', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => simplefinConnections.id, { onDelete: 'cascade' }),
  simplefinAccountId: text('simplefin_account_id').notNull(),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  simplefinAccountName: text('simplefin_account_name').notNull(),
  isEnabled: integer('is_enabled').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('simplefin_account_mapping_unique').on(table.connectionId, table.simplefinAccountId),
]);

export const plaidConfig = sqliteTable('plaid_config', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  secret: text('secret').notNull(),
  environment: text('environment').notNull().default('development'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const plaidItems = sqliteTable('plaid_items', {
  id: text('id').primaryKey(),
  plaidItemId: text('plaid_item_id').notNull(),
  institutionId: text('institution_id').notNull(),
  institutionName: text('institution_name').notNull(),
  accessToken: text('access_token').notNull(),
  cursor: text('cursor'),
  lastSyncedAt: text('last_synced_at'),
  syncStatus: text('sync_status').notNull().default('good'),
  syncError: text('sync_error'),
  consentExpiresAt: text('consent_expires_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const plaidAccountMappings = sqliteTable('plaid_account_mappings', {
  id: text('id').primaryKey(),
  plaidItemId: text('plaid_item_id').notNull().references(() => plaidItems.id, { onDelete: 'cascade' }),
  plaidAccountId: text('plaid_account_id').notNull(),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  plaidAccountName: text('plaid_account_name').notNull(),
  plaidAccountType: text('plaid_account_type').notNull(),
  plaidAccountMask: text('plaid_account_mask'),
  isEnabled: integer('is_enabled').notNull().default(1),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('plaid_account_mapping_unique').on(table.plaidItemId, table.plaidAccountId),
]);
