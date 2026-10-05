# Convert currencies when reading, never store converted amounts

Accounts hold pesos or dollars, while the budget, reports and net worth show one combined total. We store only each transaction's native amount and a table of daily exchange rates, and compute every converted amount when it is read: a transaction at the rate of its own date, a balance at the rate of the day shown.

## Considered Options

- **Freeze a home-currency value on each transaction when it is saved.** Simpler sums, and past totals can never move. Rejected because a corrected or backfilled rate would leave stored values stale until a recalculation runs, and because the viewing-currency switch needs conversion in both directions, which a single stored pesos value cannot give.

## Consequences

- Editing an exchange rate for a past date changes every total that used it, immediately. This is intended.
- Every sum that combines accounts must go through the conversion; a plain sum of amounts across accounts of different currencies is a bug.
- The budget counts dollar income at the rate of the day it arrived and never revalues it, so exchange gains and losses on dollars held on budget are not tracked. Only net worth moves with the dollar.
