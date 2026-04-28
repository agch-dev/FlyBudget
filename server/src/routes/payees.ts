import { Router } from 'express';
import { db } from '../db/index.js';
import { payees, transactions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const payeesRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  defaultCategoryId: z.string().nullable().optional(),
});

payeesRouter.get('/', (_req, res) => {
  const rows = db.select().from(payees).all();
  res.json(rows);
});

payeesRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const payee = { id: nanoid(), ...parsed.data, defaultCategoryId: parsed.data.defaultCategoryId ?? null, createdAt: new Date().toISOString() };
  db.insert(payees).values(payee).run();
  res.status(201).json(payee);
});

payeesRouter.put('/:id', (req, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  db.update(payees).set(parsed.data).where(eq(payees.id, req.params.id)).run();
  const updated = db.select().from(payees).where(eq(payees.id, req.params.id)).get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

payeesRouter.delete('/:id', (req, res) => {
  db.update(transactions).set({ payeeId: null }).where(eq(transactions.payeeId, req.params.id)).run();
  db.delete(payees).where(eq(payees.id, req.params.id)).run();
  res.status(204).send();
});
