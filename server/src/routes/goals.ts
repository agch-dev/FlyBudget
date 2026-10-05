import { Router } from 'express';
import { db } from '../db/index.js';
import { goals } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { isoDate } from '../utils/validation.js';
import { currencySchema, HOME_CURRENCY } from '../utils/currency.js';
import { converter } from '../services/currencyConversion.js';
import { listRates } from '../services/exchangeRateService.js';
import { goalCurrency, goalInPesos } from '../services/goalAmounts.js';
import { accountCurrencyLookup, existingAccountCurrency } from '../services/accountCurrency.js';

export const goalsRouter = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  targetAmount: z.number().int().min(0).max(1e13),
  currentAmount: z.number().int().min(-1e13).max(1e13).optional(),
  targetDate: isoDate.nullable().optional(),
  accountId: z.string().max(64).nullable().optional(),
  // Only for a goal with no linked account: a linked goal is in its account's currency
  currency: currencySchema.optional(),
  icon: z.string().max(32).optional(),
  // Used in inline styles on the client
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

type GoalRow = typeof goals.$inferSelect;

/**
 * Goals as the API sends them: `currency` is the linked account's when there is one, and
 * `inPesos` holds the amounts in pesos at today's rate (null when they can't be converted),
 * which is what the Goals page adds up.
 */
function present(rows: GoalRow[]) {
  const currencyOf = accountCurrencyLookup();
  const convert = converter(listRates());
  const today = format(new Date(), 'yyyy-MM-dd');
  return rows.map((row) => {
    const linked = row.accountId ? { currency: currencyOf(row.accountId) } : null;
    const currency = goalCurrency(row, linked);
    return { ...row, currency, inPesos: goalInPesos(row, currency, convert, today) };
  });
}

goalsRouter.get('/', (_req, res) => {
  const rows = db.select().from(goals).orderBy(goals.sortOrder).all();
  res.json(present(rows));
});

goalsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const accountId = parsed.data.accountId ?? null;
  const linked = accountId ? existingAccountCurrency(accountId) : undefined;
  if (accountId && !linked) return res.status(400).json({ error: 'Account not found' });

  const now = new Date().toISOString();
  const row: GoalRow = {
    id: nanoid(),
    name: parsed.data.name,
    targetAmount: parsed.data.targetAmount,
    currentAmount: parsed.data.currentAmount ?? 0,
    targetDate: parsed.data.targetDate ?? null,
    accountId,
    currency: linked ?? parsed.data.currency ?? HOME_CURRENCY,
    icon: parsed.data.icon ?? '🎯',
    color: parsed.data.color ?? '#2563EB',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(goals).values(row).run();
  res.status(201).json(present([row])[0]);
});

goalsRouter.put('/:id', (req, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = db.select().from(goals).where(eq(goals.id, req.params.id)).get();
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const update: Partial<GoalRow> = { updatedAt: new Date().toISOString() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.targetAmount !== undefined) update.targetAmount = parsed.data.targetAmount;
  if (parsed.data.currentAmount !== undefined) update.currentAmount = parsed.data.currentAmount;
  if (parsed.data.targetDate !== undefined) update.targetDate = parsed.data.targetDate;
  if (parsed.data.accountId !== undefined) update.accountId = parsed.data.accountId;
  if (parsed.data.icon !== undefined) update.icon = parsed.data.icon;
  if (parsed.data.color !== undefined) update.color = parsed.data.color;

  // The goal's currency is its linked account's. With no account it is the one sent, else the
  // one it had (its account's, when this update unlinks it), so its amounts keep their meaning.
  const accountId =
    parsed.data.accountId !== undefined ? parsed.data.accountId : existing.accountId;
  const linked = accountId ? existingAccountCurrency(accountId) : undefined;
  if (parsed.data.accountId && !linked) return res.status(400).json({ error: 'Account not found' });
  const before = existing.accountId ? existingAccountCurrency(existing.accountId) : undefined;
  update.currency =
    linked ?? parsed.data.currency ?? goalCurrency(existing, before ? { currency: before } : null);

  db.update(goals).set(update).where(eq(goals.id, req.params.id)).run();
  const updated = db.select().from(goals).where(eq(goals.id, req.params.id)).get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(present([updated])[0]);
});

goalsRouter.delete('/:id', (req, res) => {
  db.delete(goals).where(eq(goals.id, req.params.id)).run();
  res.status(204).send();
});
