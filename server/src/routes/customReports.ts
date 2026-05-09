import { Router } from 'express';
import { db } from '../db/index.js';
import { customReports } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const customReportsRouter = Router();

const configSchema = z.object({
  chartType: z.enum(['bar', 'stacked-bar', 'line', 'area', 'donut', 'table']),
  mode: z.enum(['total', 'time']),
  groupBy: z.enum(['category', 'categoryGroup', 'payee', 'account', 'month']),
  balanceType: z.enum(['expense', 'income', 'net']),
  dateRange: z.object({
    preset: z.enum(['3m', '6m', '12m', 'ytd', 'last-year', 'all', 'custom']),
    from: z.string(),
    to: z.string(),
  }),
  filters: z.object({
    accountIds: z.array(z.string()),
    categoryIds: z.array(z.string()),
    categoryGroupIds: z.array(z.string()),
  }),
});

const createSchema = z.object({
  name: z.string().min(1),
  config: configSchema,
});

function parseRow(r: typeof customReports.$inferSelect) {
  return { ...r, config: JSON.parse(r.config) };
}

customReportsRouter.get('/', (_req, res) => {
  const rows = db.select().from(customReports).orderBy(customReports.sortOrder).all();
  res.json(rows.map(parseRow));
});

customReportsRouter.get('/:id', (req, res) => {
  const row = db.select().from(customReports).where(eq(customReports.id, req.params.id)).get();
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(parseRow(row));
});

customReportsRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const now = new Date().toISOString();
  const row = {
    id: nanoid(),
    name: parsed.data.name,
    config: JSON.stringify(parsed.data.config),
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(customReports).values(row).run();
  res.status(201).json(parseRow(row));
});

customReportsRouter.put('/:id', (req, res) => {
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.config) update.config = JSON.stringify(parsed.data.config);

  db.update(customReports).set(update).where(eq(customReports.id, req.params.id)).run();
  const updated = db.select().from(customReports).where(eq(customReports.id, req.params.id)).get();
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(parseRow(updated));
});

customReportsRouter.delete('/:id', (req, res) => {
  db.delete(customReports).where(eq(customReports.id, req.params.id)).run();
  res.status(204).send();
});
