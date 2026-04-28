import { Router } from 'express';
import { db } from '../db/index.js';
import { rules } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const rulesRouter = Router();

const conditionSchema = z.object({
  field: z.enum(['payee_name', 'amount', 'notes']),
  op: z.enum(['contains', 'starts_with', 'ends_with', 'exact', 'regex']),
  value: z.string(),
});

const actionSchema = z.object({
  field: z.enum(['category_id', 'payee_id', 'notes']),
  value: z.string(),
});

const ruleSchema = z.object({
  conditions: z.array(conditionSchema),
  actions: z.array(actionSchema),
  sortOrder: z.number().int().default(0),
});

rulesRouter.get('/', (_req, res) => {
  const rows = db.select().from(rules).orderBy(rules.sortOrder).all();
  res.json(rows.map((r) => ({ ...r, conditions: JSON.parse(r.conditions), actions: JSON.parse(r.actions) })));
});

rulesRouter.post('/', (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const rule = {
    id: nanoid(),
    conditions: JSON.stringify(parsed.data.conditions),
    actions: JSON.stringify(parsed.data.actions),
    sortOrder: parsed.data.sortOrder,
    createdAt: new Date().toISOString(),
  };
  db.insert(rules).values(rule).run();
  res.status(201).json({ ...rule, conditions: parsed.data.conditions, actions: parsed.data.actions });
});

rulesRouter.put('/:id', (req, res) => {
  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const update: Record<string, unknown> = {};
  if (parsed.data.conditions) update.conditions = JSON.stringify(parsed.data.conditions);
  if (parsed.data.actions) update.actions = JSON.stringify(parsed.data.actions);
  if (parsed.data.sortOrder !== undefined) update.sortOrder = parsed.data.sortOrder;

  db.update(rules).set(update).where(eq(rules.id, req.params.id)).run();
  const updated = db.select().from(rules).where(eq(rules.id, req.params.id)).get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ ...updated, conditions: JSON.parse(updated.conditions), actions: JSON.parse(updated.actions) });
});

rulesRouter.delete('/:id', (req, res) => {
  db.delete(rules).where(eq(rules.id, req.params.id)).run();
  res.status(204).send();
});
