# Testing assets

Sample CSV files for testing imports, currencies and transfer suggestions by hand. They go with the checklist in `.scratch/multi-currency/manual-test-checklist.md`.

Every expected result below was checked by running the files through the app's own import reader (`client/src/utils/csv.ts`) and suggestion rule (`server/src/services/transferSuggestions.ts`). What the dialog and the pages then show is yours to check.

## Before you start

Don't import these into your real budget. Start the server on a throwaway database (`DB_PATH=testing.db npm run dev` from `server/`, plus the client), or use accounts you will delete afterwards.

Create these accounts:

| Account      | Type        | Currency | Account Group |
| ------------ | ----------- | -------- | ------------- |
| Test Pesos A | Checking    | UYU      |               |
| Test Pesos B | Savings     | UYU      |               |
| Test Dolares | Savings     | USD      |               |
| Test Card    | Credit card | UYU      | Test Card     |
| Test Card US | Credit card | USD      | Test Card     |

The cross-currency cases use September 2026 exchange rates as they are stored today (for example 40.236 on Sep 1 and 40.142 on Sep 18). A throwaway database fetches them on first start. If a rate differs in yours, the amounts in T10 to T14 and in `conversion/` shift with it.

## transfers/

Import `pesos-a.csv` into Test Pesos A, `pesos-b.csv` into Test Pesos B and `dolares.csv` into Test Dolares. The case number is at the start of each payee.

After all three, "Possible transfers" should list **10** pairs:

| Case | What it tests                                             | Expected                            |
| ---- | --------------------------------------------------------- | ----------------------------------- |
| T01  | Same day, same amount                                     | Suggested                           |
| T02  | 3 days apart                                              | Suggested                           |
| T03  | 4 days apart                                              | Not suggested                       |
| T04  | $7,500.00 out, $7,499.99 in                               | Not suggested                       |
| T05  | The inflow is dated 2 days before the outflow             | Suggested                           |
| T06  | Two $2,000 outflows (Sep 14 and 15), one inflow (Sep 15)  | Only T06b (same day) is suggested   |
| T07  | An outflow and an inflow in the same account              | Not suggested                       |
| T08  | Two outflows in different accounts                        | Not suggested                       |
| T09  | From Pesos B to Pesos A (the other direction)             | Suggested                           |
| T10  | $40,236.00 for US$1,000.00 on Sep 1                       | Suggested, rate 40.236              |
| T11  | $20,691.13 for US$500.00: 2.9% above the day's rate       | Suggested, rate 41.382              |
| T12  | $12,452.11 for US$300.00: 3.1% above the day's rate       | Not suggested                       |
| T13  | US$200.00 out on Sep 15, $7,950.00 in on Sep 16           | Suggested, rate 39.75               |
| T14  | $10,035.50 out on Saturday Sep 19, US$250.00 in on Sep 21 | Suggested, rate 40.142 (Friday's)   |
| T20  | A plain pair to change by hand                            | Suggested, until you split one side |

"Supermarket", "Salary", "Interest" and "Streaming" are ordinary transactions and should never be suggested.

Follow-up steps:

- **T06:** click "Not a transfer" on T06b. T06a should then be suggested with the same inflow.
- **T20:** split one side in the detail panel. The suggestion should go away.
- **T12:** open either side and use "Link as transfer" by hand. It should link, since the manual link has no rate check.
- **T04:** the same by hand should be refused: the same currency needs the same amount.
- **Import one side only:** on a fresh database import just `pesos-a.csv`. Nothing should be suggested (T07 is within one account), and the banner appears when the second file goes in, without a reload.
- **Account pages:** Test Pesos B should show its 6 pairs, Test Dolares its 4, `/transactions` all 10.

### before-first-rate-\*.csv (T15)

Import `before-first-rate-pesos-a.csv` into Test Pesos A and `before-first-rate-dolares.csv` into Test Dolares. Both are dated 2023-12-20, before the earliest stored rate (2024-01-02).

Importing the dollars file makes the server ask the rate source for the missing history, once. What happens next depends on its answer:

- **No earlier rates:** T15 is not suggested, and the estimated-rates banner names 2023-12-20. Enter a rate of 39 for that date in Settings → Exchange rates: the banner goes away and T15 is suggested.
- **Earlier rates arrive:** there is no banner, and T15 is suggested if $39.00 per dollar is within 3% of that day's rate.

## import-formats/

Any pesos account works. Import `english-month-first.csv` before `overlapping-statement.csv`.

| File                             | What it tests                                                                                      | Expected                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `english-month-first.csv`        | Month-first dates, `"-1,234.56"`, `(25.00)`, `$2,500.00`, `18.20-`, two identical rows             | Guessed month first and point. 6 rows: -4.50, -4.50, -1,234.56, -25.00, +2,500.00, -18.20. Both coffees import                                                                       |
| `overlapping-statement.csv`      | A statement that overlaps the previous one                                                         | 3 rows marked as already there, 2 new (Bookstore -32.00, Coffee Shop -4.50)                                                                                                          |
| `bank-preamble-debit-credit.csv` | Santander-style: account details above the headers, a header the rows leave out, Débito/Crédito    | Guessed day first and point. 3 rows: -6,425.00, +80,000.00, -2,310.50. The "Saldo inicial" and "Saldo final" lines are not imported, and the balance column is not read as an amount |
| `semicolon-comma-decimals.csv`   | `;` delimiter, `1.234,56` amounts                                                                  | Guessed day first and comma. 4 rows: -25,000.00, -3,456.78, -890.50, +1,200.00                                                                                                       |
| `windows-1252.csv`               | An older bank encoding (not UTF-8)                                                                 | Accents read correctly: "Panadería Ñandú" -350.00, "Peluquería" -1,200.00, "Devolución almacén" +480.00                                                                              |
| `problem-rows.csv`               | Rows that can't be read                                                                            | 2 rows import (-10.00, +45.00). 4 are listed as problems: rows 2 and 3 (date), 4 and 5 (amount). "No amount" and "Zero amount" are left out without a message                        |
| `unusual-text.csv`               | Text that could be mistaken for a formula or for HTML, quotes, a line break, a 660-character payee | 8 rows. `<script>` shows as text. The long payee is cut at 500 characters. In the transactions CSV export the cells starting with `=`, `+`, `-` and `@` start with `'`               |

Also worth doing with these:

- Import any file a second time: every row should be marked as already there.
- In `semicolon-comma-decimals.csv`, switch Decimals to point: all four rows should turn into problems, not wrong amounts.
- In `problem-rows.csv`, switch Decimals to comma: "Three decimals" (`-1.234`) becomes a readable -1,234.00 and the good rows become problems.
- Import a file, then open the dialog again for the same account: Dates, Decimals and the column mapping should be remembered.

## two-currencies/

| File                             | Import into       | Expected                                                                                                                                                                                                                     |
| -------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card-pesos-dolares-columns.csv` | Test Card         | "Purchases are positive" is ticked. "Rows in dollars go to" preselects Test Card US. Test Card gets Supermercado -1,343.28 and Pago Automatico +13,821.26; Test Card US gets Streaming -9.99, Reembolso +4.99, Hotel -120.00 |
| `card-moneda-column.csv`         | Test Card         | Test Card gets DLOPedidosYa -666.89, Heladera -1,000.00 (the instalment, not the 12,000 total), Farmacia -455.50, Pago +5,000.00; Test Card US gets APPLECOMBILL -3.03                                                       |
| `currency-column-other-bank.csv` | Any pesos account | The Currency column (EUR) is ignored: 2 rows, -120.00 and -18.50, and no "Rows in dollars go to"                                                                                                                             |

More to try with the card files:

- Choose "leave out" for the dollar rows: only the pesos rows import.
- Import a card file into Test Card US instead: the pesos rows should be the ones offered a destination.
- Import a card file into Test Pesos A (not a card, no group): no destination is preselected and "Purchases are positive" is not ticked.
- Give a third USD credit card the group "Test Card": with two candidates, nothing is preselected.
- Nothing is converted: the amounts above are exactly what each account receives.

## conversion/

Import `dollar-income-and-spending.csv` into Test Dolares. Hovering each amount where it feeds a pesos total (and the detail panel) should show:

| Date         | Payee             | Native      | Rate              | In pesos   |
| ------------ | ----------------- | ----------- | ----------------- | ---------- |
| Sep 1        | Salary in dollars | US$2,000.00 | 40.236            | $80,472.00 |
| Sep 11       | Online course     | -US$50.00   | 40.200            | -$2,010.00 |
| Sep 25       | Flight            | -US$100.00  | 40.390            | -$4,039.00 |
| Sep 26 (Sat) | Saturday dinner   | -US$30.00   | 40.390 (Friday's) | -$1,211.70 |

Categorize them (the salary as income) and check September: the Budget counts $80,472.00 of income and $7,260.70 of spending from these four, in pesos whatever the viewing currency. Then change the Sep 25 rate by hand to 41: Flight becomes $4,100.00 and Saturday dinner $1,230.00 everywhere, without a reload, and the other two don't move.

## rules/

Create a rule first: payee contains "amazon", amount greater than 100, currency is USD, set a category. Its summary and the editor's amount field should read `US$`, not `$`.

Import `amazon-pesos.csv` into Test Pesos A and `amazon-dolares.csv` into Test Dolares (the two files are identical). Of the four transactions only the US$150.00 one gets the category.

## Not covered by these files

- Excel files (`.xlsx`, `.xls`): use a real statement.
- Reconciled transactions: reconcile an account after importing, then check its pairs leave the suggestions.
- Recurring items, goals, backups and the viewing currency switch need no files.
