import { Router } from 'express';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';
import { eq, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const accountsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['checking', 'savings', 'credit', 'cash', 'investment']),
  startingBalance: z.number().int().default(0),
  isOffBudget: z.number().int().min(0).max(1).default(0),
});

const updateSchema = createSchema.partial();

function withBalance(account: typeof accounts.$inferSelect) {
  const row = db
    .select({ sum: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(eq(transactions.accountId, account.id))
    .get();
  return { ...account, balance: account.startingBalance + (row?.sum ?? 0) };
}

accountsRouter.get('/', (_req, res) => {
  const rows = db.select().from(accounts).where(isNull(accounts.closedAt)).all();
  if (!rows.length) return res.json([]);

  const sums = db
    .select({
      accountId: transactions.accountId,
      sum: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .groupBy(transactions.accountId)
    .all();

  const sumMap = Object.fromEntries(sums.map((s) => [s.accountId, s.sum]));
  res.json(rows.map((a) => ({ ...a, balance: a.startingBalance + (sumMap[a.id] ?? 0) })));
});

accountsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const account = { id: nanoid(), ...parsed.data, sortOrder: 0, closedAt: null, createdAt: new Date().toISOString() };
  db.insert(accounts).values(account).run();
  res.status(201).json(withBalance(account as typeof accounts.$inferSelect));
});

accountsRouter.put('/:id', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  db.update(accounts).set(parsed.data).where(eq(accounts.id, req.params.id)).run();
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
