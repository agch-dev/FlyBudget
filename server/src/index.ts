import express from 'express';
import cors from 'cors';
import { accountsRouter } from './routes/accounts.js';
import { categoriesRouter } from './routes/categories.js';
import { transactionsRouter } from './routes/transactions.js';
import { budgetRouter } from './routes/budget.js';
import { payeesRouter } from './routes/payees.js';
import { rulesRouter } from './routes/rules.js';
import { reportsRouter } from './routes/reports.js';
import { exportRouter } from './routes/export.js';
import { customReportsRouter } from './routes/customReports.js';

const app = express();

// origin: true reflects the request origin — safe because we bind only to 127.0.0.1
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/payees', payeesRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/export', exportRouter);
app.use('/api/custom-reports', customReportsRouter);

export async function startServer(port: number | string): Promise<void> {
  if (process.env.ELECTRON_PROD) {
    const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
    const { db } = await import('./db/index.js');
    migrate(db, { migrationsFolder: process.env.MIGRATIONS_PATH! });
  }
  return new Promise((resolve) => {
    app.listen(Number(port), '127.0.0.1', () => {
      console.log(`Server running on http://localhost:${port}`);
      resolve();
    });
  });
}

// Web dev: start immediately when neither Electron flag is set
if (!process.env.ELECTRON_DEV && !process.env.ELECTRON_PROD) {
  startServer(process.env.PORT ?? 3001).catch(console.error);
}
