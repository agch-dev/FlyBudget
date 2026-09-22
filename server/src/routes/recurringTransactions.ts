import { Router } from 'express';
import { db } from '../db/index.js';
import { recurringTransactions, transactions, payees } from '../db/schema.js';
import { eq, and, gte, lte, isNotNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { computeOccurrences, type Frequency } from '../utils/recurrence.js';

export const recurringTransactionsRouter = Router();

const frequencyEnum = z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly', 'quarterly', 'semiannually', 'yearly']);
const statusEnum = z.enum(['active', 'paused', 'canceled']);

const createSchema = z.object({
  title: z.string().min(1),
  amount: z.number().int(),
  isApproximate: z.number().int().min(0).max(1).default(0),
  frequency: frequencyEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  accountId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  payeeId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: statusEnum.default('active'),
  autoCreate: z.number().int().min(0).max(1).default(0),
});

const updateSchema = createSchema.partial();

// GET / — list all recurring transactions
recurringTransactionsRouter.get('/', (req, res) => {
  const status = req.query.status as string | undefined;
  const conditions = status ? [eq(recurringTransactions.status, status)] : [];
  const rows = db
    .select()
    .from(recurringTransactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(recurringTransactions.title)
    .all();
  res.json(rows);
});

// GET /occurrences — compute occurrences for a date range with paid status
recurringTransactionsRouter.get('/occurrences', (req, res) => {
  const from = req.query.from as string;
  const to = req.query.to as string;
  if (!from || !to) return res.status(400).json({ error: 'from and to query params required' });

  const status = (req.query.status as string) || 'active';
  const recs = db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.status, status))
    .all();

  const linkedTxns = db
    .select()
    .from(transactions)
    .where(
      and(
        isNotNull(transactions.recurringTransactionId),
        gte(transactions.date, format(subDays(parseISO(from), 3), 'yyyy-MM-dd')),
        lte(transactions.date, format(addDays(parseISO(to), 3), 'yyyy-MM-dd')),
      ),
    )
    .all();

  const txnMap = new Map<string, typeof linkedTxns>();
  for (const tx of linkedTxns) {
    const key = tx.recurringTransactionId!;
    const list = txnMap.get(key) || [];
    list.push(tx);
    txnMap.set(key, list);
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const occurrences: any[] = [];

  for (const rec of recs) {
    const dates = computeOccurrences(
      { startDate: rec.startDate, endDate: rec.endDate, frequency: rec.frequency as Frequency },
      from,
      to,
    );

    const recTxns = txnMap.get(rec.id) || [];

    for (const date of dates) {
      const d = parseISO(date);
      const matched = recTxns.find((tx) => {
        const txDate = parseISO(tx.date);
        return Math.abs(d.getTime() - txDate.getTime()) <= 3 * 24 * 60 * 60 * 1000;
      });

      let occStatus: string;
      if (matched) {
        occStatus = matched.amount !== rec.amount ? 'paid_different' : 'paid';
      } else if (date < today) {
        occStatus = 'overdue';
      } else {
        occStatus = 'upcoming';
      }

      occurrences.push({
        recurringTransactionId: rec.id,
        title: rec.title,
        expectedDate: date,
        expectedAmount: rec.amount,
        isApproximate: Boolean(rec.isApproximate),
        frequency: rec.frequency,
        status: occStatus,
        linkedTransactionId: matched?.id ?? null,
        linkedAmount: matched?.amount ?? null,
        accountId: rec.accountId,
        categoryId: rec.categoryId,
      });
    }
  }

  occurrences.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  res.json(occurrences);
});

// GET /summary — income/expense totals for a month
recurringTransactionsRouter.get('/summary', (req, res) => {
  const month = req.query.month as string;
  if (!month) return res.status(400).json({ error: 'month query param required' });

  const from = `${month}-01`;
  const to = `${month}-31`;

  const recs = db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.status, 'active'))
    .all();

  let income = 0;
  let expenses = 0;

  for (const rec of recs) {
    const dates = computeOccurrences(
      { startDate: rec.startDate, endDate: rec.endDate, frequency: rec.frequency as Frequency },
      from,
      to,
    );
    const total = dates.length * rec.amount;
    if (total > 0) income += total;
    else expenses += total;
  }

  res.json({ income, expenses });
});

// GET /:id — single recurring transaction
recurringTransactionsRouter.get('/:id', (req, res) => {
  const row = db.select().from(recurringTransactions).where(eq(recurringTransactions.id, req.params.id)).get();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST / — create recurring transaction
recurringTransactionsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const now = new Date().toISOString();
  const row = {
    id: nanoid(),
    ...parsed.data,
    endDate: parsed.data.endDate ?? null,
    accountId: parsed.data.accountId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    payeeId: parsed.data.payeeId ?? null,
    notes: parsed.data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(recurringTransactions).values(row).run();
  res.status(201).json(row);
});

// PUT /:id — update recurring transaction
recurringTransactionsRouter.put('/:id', (req, res) => {
  const existing = db.select().from(recurringTransactions).where(eq(recurringTransactions.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updates = { ...parsed.data, updatedAt: new Date().toISOString() };
  db.update(recurringTransactions).set(updates).where(eq(recurringTransactions.id, req.params.id)).run();

  const updated = db.select().from(recurringTransactions).where(eq(recurringTransactions.id, req.params.id)).get();
  res.json(updated);
});

// DELETE /:id — soft-cancel or hard delete
recurringTransactionsRouter.delete('/:id', (req, res) => {
  const existing = db.select().from(recurringTransactions).where(eq(recurringTransactions.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });

  if (req.query.hard === '1') {
    db.delete(recurringTransactions).where(eq(recurringTransactions.id, req.params.id)).run();
  } else {
    db.update(recurringTransactions)
      .set({ status: 'canceled', updatedAt: new Date().toISOString() })
      .where(eq(recurringTransactions.id, req.params.id))
      .run();
  }
  res.status(204).end();
});

// POST /:id/mark-paid — create a real transaction for an occurrence
recurringTransactionsRouter.post('/:id/mark-paid', (req, res) => {
  const rec = db.select().from(recurringTransactions).where(eq(recurringTransactions.id, req.params.id)).get();
  if (!rec) return res.status(404).json({ error: 'Not found' });
  if (!rec.accountId) return res.status(400).json({ error: 'Recurring item has no account assigned' });

  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.number().int().optional(),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let payeeName = rec.title;
  if (rec.payeeId) {
    const p = db.select().from(payees).where(eq(payees.id, rec.payeeId)).get();
    if (p) payeeName = p.name;
  }

  const tx = {
    id: nanoid(),
    accountId: rec.accountId,
    date: parsed.data.date,
    amount: parsed.data.amount ?? rec.amount,
    payeeId: rec.payeeId,
    payeeName,
    categoryId: rec.categoryId,
    notes: rec.notes,
    reconciled: 0,
    transferTransactionId: null,
    isParent: 0,
    parentTransactionId: null,
    importedId: null,
    recurringTransactionId: rec.id,
    createdAt: new Date().toISOString(),
  };

  db.insert(transactions).values(tx).run();
  res.status(201).json(tx);
});

// POST /auto-create — create transactions for all due auto-create items
export function autoCreateDueRecurring(): number {
  const today = format(new Date(), 'yyyy-MM-dd');
  const recs = db
    .select()
    .from(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.status, 'active'),
        eq(recurringTransactions.autoCreate, 1),
      ),
    )
    .all();

  let created = 0;

  for (const rec of recs) {
    if (!rec.accountId) continue;

    const dates = computeOccurrences(
      { startDate: rec.startDate, endDate: rec.endDate, frequency: rec.frequency as Frequency },
      rec.startDate,
      today,
    );

    const existingTxns = db
      .select()
      .from(transactions)
      .where(eq(transactions.recurringTransactionId, rec.id))
      .all();

    for (const date of dates) {
      const d = parseISO(date);
      const alreadyExists = existingTxns.some((tx) => {
        const txDate = parseISO(tx.date);
        return Math.abs(d.getTime() - txDate.getTime()) <= 1 * 24 * 60 * 60 * 1000;
      });

      if (!alreadyExists) {
        let payeeName = rec.title;
        if (rec.payeeId) {
          const p = db.select().from(payees).where(eq(payees.id, rec.payeeId)).get();
          if (p) payeeName = p.name;
        }

        db.insert(transactions)
          .values({
            id: nanoid(),
            accountId: rec.accountId,
            date,
            amount: rec.amount,
            payeeId: rec.payeeId,
            payeeName,
            categoryId: rec.categoryId,
            notes: rec.notes,
            reconciled: 0,
            transferTransactionId: null,
            isParent: 0,
            parentTransactionId: null,
            importedId: null,
            recurringTransactionId: rec.id,
            createdAt: new Date().toISOString(),
          })
          .run();
        created++;
      }
    }
  }

  return created;
}

recurringTransactionsRouter.post('/auto-create', (_req, res) => {
  const created = autoCreateDueRecurring();
  res.json({ created });
});
