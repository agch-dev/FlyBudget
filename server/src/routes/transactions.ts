import { Router } from 'express';
import { db } from '../db/index.js';
import { transactions, payees, rules } from '../db/schema.js';
import { eq, and, like, gte, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { applyRulesToNew } from '../services/rulesEngine.js';

export const transactionsRouter = Router();

const createSchema = z.object({
  accountId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int(),
  payeeId: z.string().nullable().optional(),
  payeeName: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cleared: z.number().int().min(0).max(1).default(0),
});

const updateSchema = createSchema.partial();

transactionsRouter.get('/', (req, res) => {
  const { account_id, month, from, to, category_id, search, cleared, reconciled } = req.query as Record<string, string>;

  let query = db.select().from(transactions).$dynamic();

  const conditions = [];
  if (account_id) conditions.push(eq(transactions.accountId, account_id));
  if (month) {
    conditions.push(gte(transactions.date, `${month}-01`));
    conditions.push(lte(transactions.date, `${month}-31`));
  }
  if (from) conditions.push(gte(transactions.date, from));
  if (to) conditions.push(lte(transactions.date, to));
  if (category_id) conditions.push(eq(transactions.categoryId, category_id));
  if (search) conditions.push(like(transactions.payeeName, `%${search}%`));
  if (cleared === '0' || cleared === '1') conditions.push(eq(transactions.cleared, Number(cleared)));
  if (reconciled === '0' || reconciled === '1') conditions.push(eq(transactions.reconciled, Number(reconciled)));

  if (conditions.length) query = query.where(and(...conditions));

  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const offset = Number(req.query.offset ?? 0);

  const rows = query.orderBy(sql`${transactions.date} desc`).limit(limit).offset(offset).all();
  res.json(rows);
});

transactionsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { payeeName, payeeId, ...rest } = parsed.data;

  let resolvedPayeeId = payeeId ?? null;
  let resolvedPayeeName = payeeName ?? null;

  if (!resolvedPayeeId && payeeName) {
    const existing = db.select().from(payees).where(eq(payees.name, payeeName)).get();
    if (existing) {
      resolvedPayeeId = existing.id;
    } else {
      resolvedPayeeId = nanoid();
      db.insert(payees).values({ id: resolvedPayeeId, name: payeeName, defaultCategoryId: null, createdAt: new Date().toISOString() }).run();
    }
    resolvedPayeeName = payeeName;
  }

  // Auto-apply payee's default category if no category was provided
  let resolvedCategoryId = rest.categoryId ?? null;
  if (!resolvedCategoryId && resolvedPayeeId) {
    const payee = db.select().from(payees).where(eq(payees.id, resolvedPayeeId)).get();
    if (payee?.defaultCategoryId) resolvedCategoryId = payee.defaultCategoryId;
  }

  // Run rules engine if still no category
  if (!resolvedCategoryId) {
    const allRules = db.select().from(rules).orderBy(rules.sortOrder).all()
      .map(r => ({ ...r, conditions: JSON.parse(r.conditions), actions: JSON.parse(r.actions) }));
    const actions = applyRulesToNew(
      { payeeName: resolvedPayeeName, amount: rest.amount, notes: rest.notes ?? null, categoryId: null },
      allRules,
    );
    if (actions) {
      for (const a of actions) {
        if (a.field === 'category_id') resolvedCategoryId = a.value;
        else if (a.field === 'payee_id') resolvedPayeeId = a.value;
      }
    }
  }

  const transaction = {
    id: nanoid(),
    ...rest,
    categoryId: resolvedCategoryId,
    payeeId: resolvedPayeeId,
    payeeName: resolvedPayeeName,
    reconciled: 0,
    isParent: 0,
    transferTransactionId: null,
    parentTransactionId: null,
    importedId: null,
    createdAt: new Date().toISOString(),
  };
  db.insert(transactions).values(transaction).run();
  res.status(201).json(transaction);
});

transactionsRouter.put('/:id', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = db.select().from(transactions).where(eq(transactions.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.reconciled === 1) return res.status(403).json({ error: 'Cannot modify a reconciled transaction' });

  db.update(transactions).set(parsed.data).where(eq(transactions.id, req.params.id)).run();
  const updated = db.select().from(transactions).where(eq(transactions.id, req.params.id)).get();
  res.json(updated);
});

transactionsRouter.delete('/:id', (req, res) => {
  const existing = db.select().from(transactions).where(eq(transactions.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.reconciled === 1) return res.status(403).json({ error: 'Cannot modify a reconciled transaction' });

  db.delete(transactions).where(eq(transactions.id, req.params.id)).run();
  res.status(204).send();
});
