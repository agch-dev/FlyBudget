import { Router } from 'express';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { logoSchema } from '../utils/logo.js';
import { accountTypeSchema, defaultOffBudget } from '../utils/accountTypes.js';
import { currencySchema, HOME_CURRENCY } from '../utils/currency.js';
import { groupNameSchema, resolveGroupName } from '../utils/accountGroups.js';
import { accountTransactionSum, inAccountBalance } from '../services/balances.js';
import { CURRENCY_LOCK_MESSAGE, currencyLockLookup } from '../services/accountCurrency.js';
import { refusal } from '../utils/refusals.js';

export const accountsRouter = Router();

const fields = {
  name: z.string().trim().min(1).max(200),
  type: accountTypeSchema,
  startingBalance: z.number().int(),
  isOffBudget: z.number().int().min(0).max(1),
  currency: currencySchema,
  groupName: groupNameSchema,
};

const createSchema = z.object({
  ...fields,
  startingBalance: fields.startingBalance.default(0),
  isOffBudget: fields.isOffBudget.optional(),
  currency: fields.currency.default(HOME_CURRENCY),
  groupName: fields.groupName.optional(),
});

// Built without defaults: Zod applies `.default()` even inside `.partial()`, so an update
// that only renames an account would otherwise reset its starting balance to 0
const updateSchema = z.object(fields).partial().extend({ logo: logoSchema.optional() });

/** The group name to store: the spelling the other open accounts already use, if any */
function groupNameFor(name: string | null, accountId?: string): string | null {
  const others = db
    .select({ id: accounts.id, groupName: accounts.groupName })
    .from(accounts)
    .where(isNull(accounts.closedAt))
    .all()
    .filter((a) => a.id !== accountId);
  return resolveGroupName(
    name,
    others.map((a) => a.groupName),
  );
}

/**
 * `currencyLockedBy` tells the edit dialog whether the currency can still change, and why
 * not. `hasTransactions` stays for an app that was loaded before `currencyLockedBy` existed.
 */
function withBalance(account: typeof accounts.$inferSelect, lockOf = currencyLockLookup()) {
  const currencyLockedBy = lockOf(account.id);
  return {
    ...account,
    balance: account.startingBalance + accountTransactionSum(account.id),
    hasTransactions: currencyLockedBy === 'transactions',
    currencyLockedBy,
  };
}

accountsRouter.get('/', (_req, res) => {
  const rows = db
    .select()
    .from(accounts)
    .where(isNull(accounts.closedAt))
    .orderBy(accounts.sortOrder)
    .all();
  if (!rows.length) return res.json([]);

  const sums = db
    .select({
      accountId: transactions.accountId,
      sum: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(inAccountBalance)
    .groupBy(transactions.accountId)
    .all();

  // Every split child has a parent in the same account, so these are all accounts with rows
  const sumMap = new Map(sums.map((s) => [s.accountId, s.sum]));
  const lockOf = currencyLockLookup();
  res.json(
    rows.map((a) => ({
      ...a,
      balance: a.startingBalance + (sumMap.get(a.id) ?? 0),
      hasTransactions: sumMap.has(a.id),
      currencyLockedBy: lockOf(a.id),
    })),
  );
});

accountsRouter.get('/balances-ago', (_req, res) => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const cutoff = oneMonthAgo.toISOString().slice(0, 10);

  const rows = db.select().from(accounts).where(isNull(accounts.closedAt)).all();
  const sums = db
    .select({
      accountId: transactions.accountId,
      sum: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(sql`${transactions.date} < ${cutoff}`, inAccountBalance))
    .groupBy(transactions.accountId)
    .all();

  const sumMap = Object.fromEntries(sums.map((s) => [s.accountId, s.sum]));
  const result: Record<string, number> = {};
  for (const a of rows) {
    result[a.id] = a.startingBalance + (sumMap[a.id] ?? 0);
  }
  res.json(result);
});

accountsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = {
    id: nanoid(),
    ...parsed.data,
    groupName: groupNameFor(parsed.data.groupName ?? null),
    // Homes, cars, investments and loans stay off budget unless asked otherwise
    isOffBudget: parsed.data.isOffBudget ?? defaultOffBudget(parsed.data.type),
    sortOrder: 0,
    closedAt: null,
    createdAt: new Date().toISOString(),
  };
  db.insert(accounts).values(account).run();
  res.status(201).json(withBalance(account as typeof accounts.$inferSelect));
});

accountsRouter.put('/reorder', (req, res) => {
  const parsed = z.object({ ids: z.array(z.string().max(64)).max(10_000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  db.transaction((tx) => {
    parsed.data.ids.forEach((id, i) => {
      tx.update(accounts).set({ sortOrder: i }).where(eq(accounts.id, id)).run();
    });
  });
  res.json({ ok: true });
});

accountsRouter.put('/:id/reconcile', (req, res) => {
  const parsed = z
    .object({ transactionIds: z.array(z.string().max(64)).min(1).max(100_000) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Only this account's transactions
  const result = db
    .update(transactions)
    .set({ reconciled: 1 })
    .where(
      and(
        eq(transactions.accountId, req.params.id),
        inArray(transactions.id, parsed.data.transactionIds),
        ne(transactions.reconciled, 1),
      ),
    )
    .run();

  res.json({ reconciled: result.changes });
});

accountsRouter.put('/:id', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Amounts are stored in the account's currency, so changing it would silently turn every
  // existing transaction's pesos into dollars (or back), and the same for the amount of a
  // recurring item or a linked goal
  if (parsed.data.currency) {
    const current = db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.id, req.params.id))
      .get();
    const lock = currencyLockLookup()(req.params.id);
    if (current && current.currency !== parsed.data.currency && lock) {
      return res.status(409).json(refusal(`currency_locked_${lock}`, CURRENCY_LOCK_MESSAGE[lock]));
    }
  }

  const changes = { ...parsed.data };
  if (changes.groupName !== undefined) {
    changes.groupName = groupNameFor(changes.groupName, req.params.id);
  }
  if (Object.keys(changes).length) {
    db.update(accounts).set(changes).where(eq(accounts.id, req.params.id)).run();
  }
  const updated = db.select().from(accounts).where(eq(accounts.id, req.params.id)).get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(withBalance(updated));
});

accountsRouter.delete('/:id', (req, res) => {
  db.update(accounts)
    .set({ closedAt: new Date().toISOString() })
    .where(eq(accounts.id, req.params.id))
    .run();
  res.status(204).send();
});
