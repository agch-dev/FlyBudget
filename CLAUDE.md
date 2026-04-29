# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Start dev (both client + server):**
```bash
npm run dev          # from project root — runs client (port 5173) and server (port 3001) concurrently
```

**Client only:**
```bash
cd client
npm run dev          # Vite dev server
npm run build        # tsc + vite build
```

**Server only:**
```bash
cd server
npm run dev          # tsx watch (hot reload)
npm run db:generate  # drizzle-kit generate (after schema changes)
npm run db:migrate   # drizzle-kit migrate (apply migrations)
npm run db:seed      # seed default categories and data
```

**Type checking:**
```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

No test suite currently exists.

---

## Architecture

This is a **local-first single-user budgeting app** — zero-based envelope budgeting (like Actual Budget / YNAB). No auth, no cloud. The entire app runs on `localhost`.

### Monorepo layout
```
budgeting-project/
├── client/          # React 19 + Vite + Tailwind v4 + React Router v7
├── server/          # Node.js + Express 5 + SQLite
└── package.json     # root — only runs concurrently
```

### Data flow
- All amounts are stored and passed as **integer cents** (e.g. $12.34 → `1234`). Convert at UI boundaries only using `formatCurrency()` and `parseCents()` in `client/src/utils/currency.ts`.
- The DB is a single SQLite file (`server/budget.db`) managed by Drizzle ORM. Schema is in `server/src/db/schema.ts`. All tables use `nanoid` string PKs.
- The client never talks to SQLite directly — everything goes through the Express API at `localhost:3001/api/*`. Vite proxies `/api` to the server in dev.

### Client state split
- **Server state** (transactions, accounts, budget data): TanStack Query. Every resource has a hook in `client/src/hooks/`. Mutations call `queryClient.invalidateQueries` on success to keep cache fresh.
- **UI state** (selected month, sidebar): Zustand store at `client/src/store/appStore.ts`.

### Key conventions
- **API layer**: `client/src/api/` contains thin fetch wrappers using `apiFetch` from `./client`. Types come from `client/src/types/index.ts`.
- **Route validation**: Server routes validate request bodies with Zod before touching the DB.
- **Rules engine**: Rules are stored as JSON-serialized `conditions` and `actions` in the `rules` table. Conditions support operators: `contains`, `starts_with`, `ends_with`, `exact`, `regex` on fields `payee_name`, `amount`, `notes`. First matching rule wins.
- **Budget math**: `To Be Budgeted = income received + prior month carry-over − total budgeted`. Category balance = `budgeted + carry-over − spent`. Calculation logic lives in `server/src/routes/budget.ts`.
- **Transfers**: Linked via `transferTransactionId` on both transaction rows — deleting one side nulls the link on the other.

### Shared UI components (`client/src/components/ui/`)
- `Modal` — portal-based, ESC closes, backdrop click closes, sizes: `sm | md | lg`
- `ConfirmModal` — wraps Modal, `danger` prop for red confirm button
- `CurrencyInput` — displays formatted `$1,234.56`, stores/emits integer cents
- `Badge` — colored pill for account types and states

### Pages and routes
| Route | Page |
|---|---|
| `/budget` | Budget (zero-based envelope view) |
| `/transactions` | All transactions across all accounts |
| `/accounts/:id` | Single account transaction list |
| `/reports/*` | Reports (Net Worth, Income/Expenses, Cash Flow, Spending, Sankey, Spending Trends) |
| `/payees` | Payees management |
| `/rules` | Auto-categorization rules |

### DB schema summary
- `accounts` — type: `checking | savings | credit | cash | investment`; `isOffBudget` excludes from budget calculations; `closedAt` for soft-delete
- `category_groups` — `isIncome=1` marks income groups (affects budget math and report filtering)
- `categories` — belong to a group; used as budget envelopes
- `transactions` — `payeeName` (denormalized string) + `payeeId` (FK, nullable); `reconciled=-1` means excluded from balance
- `budget_months` — one row per category per month; stores the `budgeted` amount
- `rules` — `conditions` and `actions` stored as JSON strings; ordered by `sortOrder`
- `payees` — `defaultCategoryId` auto-applied when a payee is selected on a new transaction
