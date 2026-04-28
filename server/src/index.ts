import express from 'express';
import cors from 'cors';
import { accountsRouter } from './routes/accounts.js';
import { categoriesRouter } from './routes/categories.js';
import { transactionsRouter } from './routes/transactions.js';
import { budgetRouter } from './routes/budget.js';
import { payeesRouter } from './routes/payees.js';
import { rulesRouter } from './routes/rules.js';
import { reportsRouter } from './routes/reports.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/payees', payeesRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/reports', reportsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
