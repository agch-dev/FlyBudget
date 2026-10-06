import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { defaultGroups, seedDefaultCategories } from '../db/defaultCategories.js';
import { suppliedNames } from '../services/defaultNames.js';
import { errorHandler } from '../middleware/security.js';
import { accountsRouter } from './accounts.js';
import { budgetRouter } from './budget.js';
import { categoriesRouter } from './categories.js';
import { dashboardsRouter } from './dashboards.js';
import { exportRouter } from './export.js';
import { reportsRouter } from './reports.js';
import { transactionsRouter } from './transactions.js';

// Default Categories (ADR 0002): one budget, read by a device in Spanish and one in English.
// The database keeps the English spelling; each answer is in the language of its request.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  seedDefaultCategories();
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', accountsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/dashboards', dashboardsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

/** A request from a device in `language` (null: one that names none, like an older client) */
const send = async (language: string | null, method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(language ? { 'X-FlyBudget-Language': language } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = res.status === 204 ? '' : await res.text();
  const isJson = res.headers.get('content-type')?.includes('json');
  return { status: res.status, body: isJson ? JSON.parse(text) : text };
};

type Group = { id: string; name: string; categories: { id: string; name: string }[] };
const groupsIn = async (language: string | null) =>
  (await send(language, 'GET', '/categories')).body as Group[];
const categoryIn = async (language: string | null, id: string) =>
  (await groupsIn(language)).flatMap((g) => g.categories).find((c) => c.id === id)!.name;

const GROCERIES = 'default-category-groceries';
const FOOD = 'default-group-food';
const MONTH = '2026-03';

describe('a new budget', () => {
  it('gets its default rows under ids derived from their keys, the same on every device', async () => {
    const groups = await groupsIn('en');
    expect(groups).toHaveLength(14);
    expect(groups.find((g) => g.id === FOOD)!.name).toBe('Food & Dining');
    const ids = groups.flatMap((g) => [g.id, ...g.categories.map((c) => c.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of groups) {
      expect(g.id).toMatch(/^default-group-[a-z-]+$/);
      for (const c of g.categories) expect(c.id).toMatch(/^default-category-[a-z-]+$/);
    }
    expect(await categoryIn('en', GROCERIES)).toBe('Groceries');
  });

  it('has no "Uncategorized" category', async () => {
    const names = (await groupsIn('en')).flatMap((g) => g.categories.map((c) => c.name));
    expect(names).toHaveLength(67);
    expect(names).not.toContain('Uncategorized');
  });

  it('only has names the app can say in both languages', () => {
    const english = (kind: 'group' | 'category') => suppliedNames(kind).map((n) => n.en);
    for (const group of defaultGroups) {
      expect(english('group')).toContain(group.name);
      for (const category of group.categories) expect(english('category')).toContain(category.name);
    }
  });

  it('is not given its defaults twice', () => {
    expect(seedDefaultCategories()).toBe(0);
  });
});

describe('reading the same budget in two languages', () => {
  it('names every default category and group in the language of the request', async () => {
    const en = await groupsIn('en');
    const es = await groupsIn('es');
    expect(es.map((g) => g.id)).toEqual(en.map((g) => g.id));
    expect(es.find((g) => g.id === FOOD)!.name).toBe('Comida y restaurantes');
    expect(await categoryIn('es', GROCERIES)).toBe('Supermercado');
    // Every name is supplied, so only the entries spelled alike in both languages stay
    const same = es
      .flatMap((g, i) => g.categories.filter((c, j) => c.name === en[i].categories[j].name))
      .map((c) => c.name);
    expect(same.sort()).toEqual(['Hobbies', 'Internet', 'Marketing']);
  });

  it('answers a request with no language, or one the app does not have, in English', async () => {
    const en = await groupsIn('en');
    expect(await groupsIn(null)).toEqual(en);
    expect(await groupsIn('fr')).toEqual(en);
    expect(await groupsIn('ES')).toEqual(en);
    expect((await send('fr', 'GET', '/categories')).status).toBe(200);
  });

  it('reads the language of a file download from its address', async () => {
    const res = await send(null, 'GET', '/categories?lang=es');
    expect((res.body as Group[]).find((g) => g.id === FOOD)!.name).toBe('Comida y restaurantes');
  });

  it('names the budget’s groups and categories the same way', async () => {
    type Budget = Group[];
    const es = (await send('es', 'GET', `/budget/${MONTH}`)).body as Budget;
    const en = (await send('en', 'GET', `/budget/${MONTH}`)).body as Budget;
    const food = (b: Budget) => b.find((g) => g.id === FOOD)!;
    expect(food(es).name).toBe('Comida y restaurantes');
    expect(food(es).categories.find((c) => c.id === GROCERIES)!.name).toBe('Supermercado');
    expect(food(en).name).toBe('Food & Dining');
    expect(food(en).categories.find((c) => c.id === GROCERIES)!.name).toBe('Groceries');
  });
});

describe('renaming', () => {
  const COFFEE = 'default-category-coffee-shops';

  it('a category the user renamed reads as typed in both languages', async () => {
    const saved = await send('es', 'PUT', `/categories/${COFFEE}`, { name: '  Cafecito ' });
    expect(saved.body.name).toBe('Cafecito');
    expect(await categoryIn('es', COFFEE)).toBe('Cafecito');
    expect(await categoryIn('en', COFFEE)).toBe('Cafecito');
  });

  it('a supplied name typed in Spanish is stored in English: a default again', async () => {
    const saved = await send('es', 'PUT', `/categories/${COFFEE}`, { name: 'Cafeterías' });
    expect(saved.body.name).toBe('Cafeterías');
    expect(await categoryIn('en', COFFEE)).toBe('Coffee Shops');
    expect(await categoryIn('es', COFFEE)).toBe('Cafeterías');
  });

  it('saving the edit dialog with the Spanish name untouched keeps it a default', async () => {
    const shown = await categoryIn('es', GROCERIES);
    await send('es', 'PUT', `/categories/${GROCERIES}`, { name: shown, icon: '🛒' });
    expect(await categoryIn('en', GROCERIES)).toBe('Groceries');
  });

  it('works the same for groups', async () => {
    const own = await send('es', 'PUT', `/categories/groups/${FOOD}`, { name: 'Morfi' });
    expect(own.body.name).toBe('Morfi');
    expect((await groupsIn('en')).find((g) => g.id === FOOD)!.name).toBe('Morfi');
    const back = await send('es', 'PUT', `/categories/groups/${FOOD}`, {
      name: 'Comida y restaurantes',
    });
    expect(back.body.name).toBe('Comida y restaurantes');
    expect((await groupsIn('en')).find((g) => g.id === FOOD)!.name).toBe('Food & Dining');
  });

  it('a new category or group with a supplied name is a default, whatever language typed it', async () => {
    const group = await send('es', 'POST', '/categories/groups', {
      name: 'Estilo de vida',
      isIncome: 0,
    });
    expect(group.body.name).toBe('Estilo de vida');
    const cat = await send('es', 'POST', '/categories', {
      name: 'Nafta',
      groupId: group.body.id,
    });
    expect(cat.body.name).toBe('Nafta');
    expect(await categoryIn('en', cat.body.id)).toBe('Gas');
    expect((await groupsIn('en')).find((g) => g.id === group.body.id)!.name).toBe('Lifestyle');

    // A group's name is not a category's: "Vivienda" (Housing) as a category is the user's own
    const own = await send('es', 'POST', '/categories', {
      name: 'Vivienda',
      groupId: group.body.id,
    });
    expect(await categoryIn('en', own.body.id)).toBe('Vivienda');
  });

  it('two categories that read alike are still two categories', async () => {
    const group = (await groupsIn('en')).find((g) => g.id === FOOD)!;
    const twin = await send('es', 'POST', '/categories', { name: 'Supermercado', groupId: FOOD });
    expect(twin.body.id).not.toBe(GROCERIES);
    const after = (await groupsIn('es')).find((g) => g.id === FOOD)!;
    expect(after.categories).toHaveLength(group.categories.length + 1);
    expect(after.categories.filter((c) => c.name === 'Supermercado')).toHaveLength(2);
    await send('es', 'DELETE', `/categories/${twin.body.id}`);
  });

  it('a budget that still has "Uncategorized" reads it as "Sin clasificar"', async () => {
    const cat = await send('en', 'POST', '/categories', {
      name: 'Uncategorized',
      groupId: 'default-group-other',
    });
    expect(await categoryIn('es', cat.body.id)).toBe('Sin clasificar');
    expect(await categoryIn('en', cat.body.id)).toBe('Uncategorized');
  });
});

describe('the dashboard the app creates', () => {
  type Page = { id: string; name: string };
  const pagesIn = async (language: string | null) =>
    (await send(language, 'GET', '/dashboards')).body as Page[];

  it('reads "Vista general" in Spanish and "Overview" in English', async () => {
    expect((await pagesIn('es')).map((p) => p.name)).toEqual(['Vista general']);
    expect((await pagesIn('en')).map((p) => p.name)).toEqual(['Overview']);
    expect((await pagesIn(null)).map((p) => p.name)).toEqual(['Overview']);
  });

  it('is renamed and named back like a category', async () => {
    const [page] = await pagesIn('es');
    const own = await send('es', 'PUT', `/dashboards/${page.id}`, { name: 'Mi panel' });
    expect(own.body.name).toBe('Mi panel');
    expect((await pagesIn('en'))[0].name).toBe('Mi panel');
    const back = await send('es', 'PUT', `/dashboards/${page.id}`, { name: 'Vista general' });
    expect(back.body.name).toBe('Vista general');
    expect((await pagesIn('en'))[0].name).toBe('Overview');
  });

  it('a new dashboard called "Vista general" is stored as "Overview"', async () => {
    const made = await send('es', 'POST', '/dashboards', { name: 'Vista general' });
    expect(made.body.name).toBe('Vista general');
    expect((await pagesIn('en')).find((p) => p.id === made.body.id)!.name).toBe('Overview');
  });
});

describe('reports and files', () => {
  const RANGE = `from=${MONTH}&to=${MONTH}`;
  const PAYCHECKS = 'default-category-paychecks';
  let ownId: string;
  let accountId: string;

  beforeAll(async () => {
    const account = await send('en', 'POST', '/accounts', {
      name: 'Checking',
      type: 'checking',
      startingBalance: 0,
    });
    accountId = account.body.id;
    const own = await send('en', 'POST', '/categories', { name: 'Asado', groupId: FOOD });
    ownId = own.body.id;
    await add(-5000, GROCERIES, 'Corner Market');
    await add(-3000, ownId, 'Butcher');
    await add(-700, null, null);
    await add(90000, PAYCHECKS, 'Employer');
  });

  const add = (amount: number, categoryId: string | null, payeeName: string | null = null) =>
    send('en', 'POST', '/transactions', {
      accountId,
      date: `${MONTH}-10`,
      amount,
      categoryId,
      payeeName,
    });

  type Row = Record<string, unknown>;
  const report = async (language: string | null, path: string) =>
    (await send(language, 'GET', `/reports/${path}`)).body;

  it('spending by category names categories and groups in the request’s language', async () => {
    const es = (await report('es', `spending-by-category?${RANGE}`)) as Row[];
    const en = (await report('en', `spending-by-category?${RANGE}`)) as Row[];
    const row = (rows: Row[], id: string | null) => rows.find((r) => r.categoryId === id)!;
    expect(row(es, GROCERIES)).toMatchObject({
      categoryName: 'Supermercado',
      groupName: 'Comida y restaurantes',
      totalSpent: 5000,
    });
    expect(row(en, GROCERIES)).toMatchObject({
      categoryName: 'Groceries',
      groupName: 'Food & Dining',
    });
    expect(row(es, ownId)).toMatchObject({ categoryName: 'Asado' });
    expect(row(es, null)).toMatchObject({ categoryName: null, groupName: null, totalSpent: 700 });
  });

  it('income by category and spending trends do too', async () => {
    const income = (await report('es', `income-by-category?${RANGE}`)) as Row[];
    expect(income).toEqual([
      expect.objectContaining({ categoryName: 'Sueldos', groupName: 'Ingresos' }),
    ]);
    const trends = (await report(
      'es',
      `spending-trends?${RANGE}&category_ids=${GROCERIES},${ownId}`,
    )) as Row[];
    expect(trends.map((r) => r.categoryName).sort()).toEqual(['Asado', 'Supermercado']);
    const english = (await report(
      null,
      `spending-trends?${RANGE}&category_ids=${GROCERIES}`,
    )) as Row[];
    expect(english.map((r) => r.categoryName)).toEqual(['Groceries']);
  });

  describe('custom reports', () => {
    const custom = (language: string | null, query: string) =>
      report(language, `custom?${RANGE}&${query}`);

    it('grouped by category: supplied names follow the language, and no category has no name', async () => {
      const es = await custom('es', 'group_by=category');
      expect(es).toEqual({
        mode: 'total',
        data: [
          { name: 'Supermercado', id: GROCERIES, value: 5000 },
          { name: 'Asado', id: ownId, value: 3000 },
          { name: null, id: null, value: 700 },
        ],
      });
      const en = await custom('en', 'group_by=category');
      expect(en.data.map((r: Row) => r.name)).toEqual(['Groceries', 'Asado', null]);
    });

    it('grouped by category group', async () => {
      const es = await custom('es', 'group_by=categoryGroup');
      expect(es.data).toEqual([
        { name: 'Comida y restaurantes', id: FOOD, value: 8000 },
        { name: null, id: null, value: 700 },
      ]);
    });

    it('grouped by payee: no payee has no name, and "Unknown" is never sent', async () => {
      const es = await custom('es', 'group_by=payee');
      const names = es.data.map((r: Row) => r.name);
      expect(names).toContain(null);
      expect(names).not.toContain('Unknown');
      expect(names).not.toContain('Uncategorized');
      expect(names).toContain('Corner Market');
    });

    it('over time: each group has a key for its figures and the name to show', async () => {
      const es = await custom('es', 'group_by=category&mode=time');
      expect(es.mode).toBe('time');
      expect(es.groups.map((g: Row) => g.name)).toEqual(['Asado', 'Supermercado', null]);
      const keys = es.groups.map((g: Row) => g.key) as string[];
      expect(new Set(keys).size).toBe(3);
      expect(es.data).toEqual([{ month: MONTH, [keys[0]]: 3000, [keys[1]]: 5000, [keys[2]]: 700 }]);
      const en = await custom('en', 'group_by=category&mode=time');
      expect(en.groups.map((g: Row) => g.name)).toEqual(['Asado', 'Groceries', null]);
    });

    it('over time, categories that read alike are one group, as before', async () => {
      // The user's own "Supermercado" is stored as "Groceries": a second category, same name
      const twin = await send('es', 'POST', '/categories', { name: 'Supermercado', groupId: FOOD });
      const tx = await add(-1000, twin.body.id);
      const es = await custom('es', 'group_by=category&mode=time');
      const groceries = es.groups.filter((g: Row) => g.name === 'Supermercado');
      expect(groceries).toHaveLength(1);
      expect(es.data[0][groceries[0].key]).toBe(6000);
      // In totals they are two rows with two ids
      const total = await custom('es', 'group_by=category');
      expect(total.data.filter((r: Row) => r.name === 'Supermercado')).toHaveLength(2);
      await send('en', 'DELETE', `/transactions/${tx.body.id}`);
      await send('en', 'DELETE', `/categories/${twin.body.id}`);
    });

    it('a category called "Uncategorized" is its own group, apart from no category', async () => {
      const cats = (await groupsIn('en')).flatMap((g) => g.categories);
      const uncategorized = cats.find((c) => c.name === 'Uncategorized')!;
      const tx = await add(-200, uncategorized.id);
      const es = await custom('es', 'group_by=category&mode=time');
      expect(es.groups.map((g: Row) => g.name)).toEqual([
        'Asado',
        'Sin clasificar',
        'Supermercado',
        null,
      ]);
      await send('en', 'DELETE', `/transactions/${tx.body.id}`);
    });
  });

  it('the transactions CSV names categories in the language of its address', async () => {
    const es = (await send(null, 'GET', '/export/transactions/csv?lang=es')).body as string;
    const en = (await send(null, 'GET', '/export/transactions/csv')).body as string;
    const column = (csv: string) =>
      csv
        .trim()
        .split('\n')
        .slice(1)
        .map((line) => line.split(',')[5]);
    expect(column(es).sort()).toEqual(['', 'Asado', 'Sueldos', 'Supermercado']);
    expect(column(en).sort()).toEqual(['', 'Asado', 'Groceries', 'Paychecks']);
  });
});
