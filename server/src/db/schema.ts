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
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('transactions_account_date_idx').on(table.accountId, table.date),
  index('transactions_category_idx').on(table.categoryId),
  index('transactions_date_idx').on(table.date),
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

export const customReports = sqliteTable('custom_reports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
