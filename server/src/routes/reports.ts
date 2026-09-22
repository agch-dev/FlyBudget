import { Router } from 'express';
import { db } from '../db/index.js';
import { transactions, accounts, categories, categoryGroups, payees } from '../db/schema.js';
import { eq, and, gte, lte, sql, inArray, lt } from 'drizzle-orm';
import { monthBounds } from '../utils/date.js';

export const reportsRouter = Router();

function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  const d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

reportsRouter.get('/net-worth', (req, res) => {
  const { from = '2024-01', to = '2026-12', granularity = 'monthly' } = req.query as Record<string, string>;
  const isDaily = granularity === 'daily';

  const periods = isDaily ? dayRange(from, to) : monthRange(from, to);

  const allAccounts = db.select().from(accounts).all();

  const upperBound = isDaily ? to : monthBounds(to).to;
  const groupExpr = isDaily
    ? sql<string>`${transactions.date}`
    : sql<string>`strftime('%Y-%m', ${transactions.date})`;

  const txRows = db
    .select({
      accountId: transactions.accountId,
      period: groupExpr,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(lte(transactions.date, upperBound))
    .groupBy(transactions.accountId, groupExpr)
    .all();

  const byAccount: Record<string, Array<{ period: string; total: number }>> = {};
  for (const row of txRows) {
    (byAccount[row.accountId] ??= []).push({ period: row.period, total: row.total });
  }

  const cumulativeByAccount: Record<string, Record<string, number>> = {};
  for (const acct of allAccounts) {
    const entries = (byAccount[acct.id] ?? []).sort((a, b) => a.period.localeCompare(b.period));
    let running = acct.startingBalance;
    const cumMap: Record<string, number> = {};
    for (const { period, total } of entries) {
      running += total;
      cumMap[period] = running;
    }
    cumulativeByAccount[acct.id] = cumMap;
  }

  function balanceAt(acctId: string, target: string, startingBalance: number): number {
    const cumMap = cumulativeByAccount[acctId] ?? {};
    let balance = startingBalance;
    for (const k of Object.keys(cumMap).sort()) {
      if (k > target) break;
      balance = cumMap[k];
    }
    return balance;
  }

  const result = periods.map((period) => {
    let assets = 0, liabilities = 0;
    for (const acct of allAccounts) {
      const balance = balanceAt(acct.id, period, acct.startingBalance);
      if (acct.type === 'credit') liabilities += Math.abs(Math.min(balance, 0));
      else assets += Math.max(balance, 0);
    }
    return { month: period, assets, liabilities, netWorth: assets - liabilities };
  });

  res.json(result);
});

reportsRouter.get('/spending-by-category', (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conditions = [];
  if (from) conditions.push(gte(transactions.date, monthBounds(from).from));
  if (to) conditions.push(lte(transactions.date, monthBounds(to).to));

  const rows = db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      groupName: categoryGroups.name,
      totalSpent: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(transactions.categoryId)
    .all();

  res.json(rows.filter((r) => r.totalSpent < 0).map((r) => ({ ...r, totalSpent: Math.abs(r.totalSpent) })));
});

reportsRouter.get('/income-vs-expenses', (req, res) => {
  const { from = '2024-01', to = '2026-12' } = req.query as Record<string, string>;
  const months = monthRange(from, to);

  // Single query grouped by month + isIncome
  const txRows = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
      isIncome: categoryGroups.isIncome,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(gte(transactions.date, monthBounds(from).from), lte(transactions.date, monthBounds(to).to)))
    .groupBy(sql`strftime('%Y-%m', ${transactions.date})`, categoryGroups.isIncome)
    .all();

  const dataMap: Record<string, { income: number; expenses: number }> = {};
  for (const row of txRows) {
    dataMap[row.month] ??= { income: 0, expenses: 0 };
    if (row.isIncome === 1) dataMap[row.month].income += row.total;
    else dataMap[row.month].expenses += Math.abs(Math.min(row.total, 0));
  }

  const result = months.map((month) => {
    const d = dataMap[month] ?? { income: 0, expenses: 0 };
    return { month, income: d.income, expenses: d.expenses, net: d.income - d.expenses };
  });

  res.json(result);
});

reportsRouter.get('/cash-flow', (req, res) => {
  const { from = '2024-01', to = '2026-12' } = req.query as Record<string, string>;
  const months = monthRange(from, to);

  // Single query grouped by month
  const txRows = db
    .select({
      month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
      net: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(
      gte(transactions.date, monthBounds(from).from),
      lte(transactions.date, monthBounds(to).to),
      eq(accounts.isOffBudget, 0),
    ))
    .groupBy(sql`strftime('%Y-%m', ${transactions.date})`)
    .all();

  const netMap = Object.fromEntries(txRows.map((r) => [r.month, r.net]));
  res.json(months.map((month) => ({ month, net: netMap[month] ?? 0 })));
});

reportsRouter.get('/income-by-category', (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const conditions = [eq(categoryGroups.isIncome, 1)];
  if (from) conditions.push(gte(transactions.date, monthBounds(from).from));
  if (to) conditions.push(lte(transactions.date, monthBounds(to).to));

  const rows = db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      groupName: categoryGroups.name,
      totalReceived: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(...conditions))
    .groupBy(transactions.categoryId)
    .all();

  res.json(rows.filter((r) => r.totalReceived > 0));
});

reportsRouter.get('/spending-trends', (req, res) => {
  const { category_ids, from, to } = req.query as Record<string, string>;
  if (!category_ids) return res.json([]);

  const ids = category_ids.split(',');
  const conditions = [];
  if (from) conditions.push(gte(transactions.date, monthBounds(from).from));
  if (to) conditions.push(lte(transactions.date, monthBounds(to).to));

  const rows = db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      month: sql<string>`strftime('%Y-%m', ${transactions.date})`,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(transactions.categoryId, sql`strftime('%Y-%m', ${transactions.date})`)
    .all();

  res.json(
    rows
      .filter((r) => r.categoryId && ids.includes(r.categoryId) && r.total < 0)
      .map((r) => ({ ...r, total: Math.abs(r.total) }))
  );
});

// --------------- Custom report aggregation endpoint ---------------

reportsRouter.get('/custom', (req, res) => {
  const {
    mode = 'total',
    group_by = 'category',
    balance_type = 'expense',
    from = '2024-01',
    to = '2026-12',
    account_ids,
    category_ids,
    category_group_ids,
  } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [
    gte(transactions.date, monthBounds(from).from),
    lte(transactions.date, monthBounds(to).to),
  ];

  if (balance_type === 'expense') conditions.push(lt(transactions.amount, 0));
  else if (balance_type === 'income') conditions.push(eq(categoryGroups.isIncome, 1));

  if (account_ids) {
    const ids = account_ids.split(',').filter(Boolean);
    if (ids.length) conditions.push(inArray(transactions.accountId, ids));
  }
  if (category_ids) {
    const ids = category_ids.split(',').filter(Boolean);
    if (ids.length) conditions.push(inArray(transactions.categoryId, ids));
  }
  if (category_group_ids) {
    const ids = category_group_ids.split(',').filter(Boolean);
    if (ids.length) conditions.push(inArray(categories.groupId, ids));
  }

  const groupByCol = {
    category: { name: categories.name, id: transactions.categoryId, groupCol: transactions.categoryId },
    categoryGroup: { name: categoryGroups.name, id: categories.groupId, groupCol: categories.groupId },
    payee: { name: sql<string>`coalesce(${payees.name}, ${transactions.payeeName}, 'Unknown')`, id: transactions.payeeId, groupCol: transactions.payeeId },
    account: { name: accounts.name, id: transactions.accountId, groupCol: transactions.accountId },
    month: { name: sql<string>`strftime('%Y-%m', ${transactions.date})`, id: sql<string>`strftime('%Y-%m', ${transactions.date})`, groupCol: sql`strftime('%Y-%m', ${transactions.date})` },
  }[group_by] ?? { name: categories.name, id: transactions.categoryId, groupCol: transactions.categoryId };

  const baseQuery = db
    .select({
      name: groupByCol.name,
      id: groupByCol.id,
      ...(mode === 'time' ? { month: sql<string>`strftime('%Y-%m', ${transactions.date})` } : {}),
      value: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .leftJoin(payees, eq(transactions.payeeId, payees.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions));

  if (mode === 'time') {
    const rows = baseQuery
      .groupBy(groupByCol.groupCol, sql`strftime('%Y-%m', ${transactions.date})`)
      .orderBy(sql`strftime('%Y-%m', ${transactions.date})`)
      .all() as { name: string | null; id: string | null; month: string; value: number }[];

    const months = monthRange(from, to);
    const groupSet = new Set<string>();
    for (const r of rows) groupSet.add(r.name || 'Uncategorized');
    const groups = Array.from(groupSet).sort();

    const dataMap = new Map<string, Record<string, number>>();
    for (const m of months) dataMap.set(m, {});

    for (const r of rows) {
      const label = r.name || 'Uncategorized';
      const bucket = dataMap.get(r.month);
      if (bucket) {
        const val = balance_type === 'expense' ? Math.abs(r.value) : r.value;
        bucket[label] = (bucket[label] || 0) + val;
      }
    }

    const data = months.map(m => ({ month: m, ...dataMap.get(m)! }));
    res.json({ mode: 'time', groups, data });
  } else {
    const rows = baseQuery
      .groupBy(groupByCol.groupCol)
      .orderBy(sql`abs(sum(${transactions.amount})) desc`)
      .all() as { name: string | null; id: string | null; value: number }[];

    const data = rows
      .filter(r => r.value !== 0)
      .map(r => ({
        name: r.name || 'Uncategorized',
        id: r.id,
        value: balance_type === 'expense' ? Math.abs(r.value) : r.value,
      }));

    res.json({ mode: 'total', data });
  }
});
