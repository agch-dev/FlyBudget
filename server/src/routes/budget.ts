import { Router } from 'express';
import { db } from '../db/index.js';
import { budgetMonths, categories, categoryGroups, transactions } from '../db/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { monthBounds } from '../utils/date.js';

export const budgetRouter = Router();

const upsertSchema = z.object({ budgeted: z.number().int() });

budgetRouter.get('/:month', (req, res) => {
  const { month } = req.params;
  const { from, to } = monthBounds(month);

  const groups = db.select().from(categoryGroups).orderBy(categoryGroups.sortOrder).all();
  const cats = db.select().from(categories).orderBy(categories.sortOrder).all();
  const budgeted = db.select().from(budgetMonths).where(eq(budgetMonths.month, month)).all();

  const spentRows = db
    .select({
      categoryId: transactions.categoryId,
      spent: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(gte(transactions.date, from), lte(transactions.date, to)))
    .groupBy(transactions.categoryId)
    .all();

  const spentMap = Object.fromEntries(spentRows.map((r) => [r.categoryId, r.spent]));
  const budgetMap = Object.fromEntries(budgeted.map((b) => [b.categoryId, b]));

  const result = groups.map((g) => ({
    ...g,
    categories: cats
      .filter((c) => c.groupId === g.id)
      .map((c) => {
        const bm = budgetMap[c.id];
        const budgetedAmt = bm?.budgeted ?? 0;
        const spentAmt = spentMap[c.id] ?? 0;
        return {
          ...c,
          budgeted: budgetedAmt,
          spent: Math.abs(Math.min(spentAmt, 0)),
          balance: budgetedAmt + spentAmt,
        };
      }),
  }));

  res.json(result);
});

budgetRouter.put('/:month/:categoryId', (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { month, categoryId } = req.params;
  const existing = db
    .select()
    .from(budgetMonths)
    .where(and(eq(budgetMonths.month, month), eq(budgetMonths.categoryId, categoryId)))
    .get();

  if (existing) {
    db.update(budgetMonths).set({ budgeted: parsed.data.budgeted }).where(eq(budgetMonths.id, existing.id)).run();
  } else {
    db.insert(budgetMonths).values({
      id: nanoid(),
      month,
      categoryId,
      budgeted: parsed.data.budgeted,
      notes: null,
    }).run();
  }

  res.json({ month, categoryId, budgeted: parsed.data.budgeted });
});

budgetRouter.get('/:month/summary', (req, res) => {
  const { month } = req.params;
  const { from, to } = monthBounds(month);

  const incomeRow = db
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(gte(transactions.date, from), lte(transactions.date, to), eq(categoryGroups.isIncome, 1)))
    .get();

  const budgetedRow = db
    .select({ total: sql<number>`coalesce(sum(${budgetMonths.budgeted}), 0)` })
    .from(budgetMonths)
    .where(eq(budgetMonths.month, month))
    .get();

  const income = incomeRow?.total ?? 0;
  const totalBudgeted = budgetedRow?.total ?? 0;

  res.json({ month, income, totalBudgeted, toBeBudgeted: income - totalBudgeted });
});
