import { db } from '../db/index.js';
import { payees, rules } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { applyRulesToNew } from './rulesEngine.js';

export function resolvePayee(payeeName: string | null | undefined, payeeId: string | null | undefined) {
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
  return { resolvedPayeeId, resolvedPayeeName };
}

export function autoCategory(payeeId: string | null, payeeName: string | null, amount: number, notes: string | null) {
  let categoryId: string | null = null;
  let resolvedPayeeId = payeeId;
  if (payeeId) {
    const payee = db.select().from(payees).where(eq(payees.id, payeeId)).get();
    if (payee?.defaultCategoryId) categoryId = payee.defaultCategoryId;
  }
  if (!categoryId) {
    const allRules = db.select().from(rules).orderBy(rules.sortOrder).all()
      .map(r => ({ ...r, conditions: JSON.parse(r.conditions), actions: JSON.parse(r.actions) }));
    const actions = applyRulesToNew({ payeeName, amount, notes, categoryId: null }, allRules);
    if (actions) {
      for (const a of actions) {
        if (a.field === 'category_id') categoryId = a.value;
        else if (a.field === 'payee_id') resolvedPayeeId = a.value;
      }
    }
  }
  return { categoryId, payeeId: resolvedPayeeId };
}
