# uy-support's import changes and what prompted each

Research for [#18](https://github.com/agch-dev/FlyBudget/issues/18), on the map
[#10](https://github.com/agch-dev/FlyBudget/issues/10). This is the checklist for checking later
that every bank-specific fix carried over to `uy-compatibility` in a generic form.

## Sources and method

- `uy-support` = `5639a1a`. It split from upstream at `75d9833` (`git merge-base main uy-support`,
  2026-10-04). Upstream `main` = `12e6b93`, which is what `uy-compatibility` has today
  (`git log main..uy-compatibility` is empty).
- Commits: `git log 75d9833..uy-support` on `client/src/utils/csv.ts`, `csv.test.ts`,
  `spreadsheet*`, `xls.ts`, `xlsx.ts`, `importDestination.ts`,
  `components/transactions/ImportModal.tsx`, `i18n/*/import.ts`, `server/src/services/csvText.ts`,
  `website/docs/importing.mdx`, `e2e/tests/data.spec.ts` and `testing-assets/`.
- Reasons: commit messages and bodies; the descriptions of fork PRs
  [#1](https://github.com/agch-dev/FlyBudget/pull/1) (which brought in every import commit),
  [#2](https://github.com/agch-dev/FlyBudget/pull/2) and
  [#5](https://github.com/agch-dev/FlyBudget/pull/5) (none of the three has comments); and the
  comments uy-support's own code and tests make about banks. No fork issue other than the map's
  talks about imports.
- "Upstream" behaviour was **checked by running upstream's own `csv.ts`** (`tsx`, unchanged) on
  uy-support's sample files (`testing-assets/import-formats/`, `testing-assets/two-currencies/`)
  and on the bank samples in uy-support's `csv.test.ts`. The probe isn't committed; the results
  are quoted below.

### Commits that changed import

| Commit               | Subject (quoted)                                                                        |
| -------------------- | --------------------------------------------------------------------------------------- |
| `f39dbe0`            | feat: import Uruguayan CSV files (semicolons, day-first dates, comma decimals)          |
| `8aae209`            | feat(client): import preview shows amounts in the account's currency                    |
| `714e31f`            | fix: import bank statements with details above the headers (Santander Uruguay)          |
| `fcef4a2`            | feat: import card statements in pesos and dollars, and Excel files                      |
| `7db00c5`            | fix: dates and amounts in the import preview stay on one line                           |
| `f22707f`            | test: sample CSV files for testing imports, currencies and transfer suggestions by hand |
| `fab585d`            | feat: transactions and import in Spanish                                                |
| `8f1c368`            | fix: the import's counts in plural forms, one key per paragraph                         |
| `5936ce4`            | feat: a transactions CSV exported in Spanish imports back                               |
| `f0488a8`            | feat: the server's CSV files follow the request language (export side)                  |
| `5b9c755`, `e186a56` | PR #5, branch `import-settings-server`: **not in uy-support** (still open)              |

The banks named anywhere: **Santander Uruguay** (bank account and card statements) and **Itaú**
(card statement, CSV and Excel). BROU, OCA and others appear only as Account Group names in tests,
never in import code.

## The inventory

Status key: **upstream** = `main` already does it (code pointer is on `uy-compatibility`);
**spec #N** = covered by a map spec; **not covered**; **don't port** = upstream's behaviour is
better or the change is out of the map's scope. ⚑ = written for one bank, needs a generic form.

### 1. Semicolon separator

- **Change:** `detectDelimiter`: `,` or `;`, whichever the header line uses more outside quotes.
- **Commit:** `f39dbe0`. **Why:** "import Uruguayan CSV files (semicolons, …)"; "The delimiter is
  detected from the header line."
- **Status: upstream.** `detectDelimiter` in `client/src/utils/csv.ts:10` (`,` `;` or tab), plus
  a Separator select in the dialog. Probe: `semicolon-comma-decimals.csv` → `;`.

### 2. Day-first dates

- **Change:** a **Dates** choice (day first / month first), guessed from cells (a first number above
  12), else **month first**; dates that aren't real under the choice are listed, not imported.
- **Commit:** `f39dbe0`. **Why:** "day-first dates … The import dialog gets Dates (day first /
  month first) … guessed from the file and remembered per account on this device."
- **Status: upstream**, stricter. `normalizeDate` / `detectDateFormat` (`csv.ts:192`, `:235`)
  read `mdy`/`dmy`/`ymd` and **ask ("Choose…") instead of falling back to month first**
  (`ImportModal.tsx:684`). uy-support's silent fallback: **don't port**.

### 3. Comma decimals

- **Change:** a **Decimals** choice (comma `1.234,56` / point), guessed from cells with one or two
  digits after the last separator, else point. Amounts built from digits, at most 2 decimals.
- **Commit:** `f39dbe0` (same quote as above: "comma decimals").
- **Status: upstream**, stricter. `detectNumberFormat` / `readImportAmount` (`csv.ts:282`, `:316`)
  ask when ambiguous (`1.234`) and use the account currency's decimals (`minor`). Fallback to
  point: **don't port**.

### 4. Unreadable rows listed, never imported as 0 or on another day

- **Change:** `readImportRows` returns `problems` ("Can't read the date/amount …"), shown in the
  map step with "Check the Dates and Decimals choices"; changing a choice re-reads the file.
- **Commit:** `f39dbe0`. **Why:** "Rows whose date or amount can't be read under the chosen
  conventions are listed instead of being imported as zero or on the wrong day."
- **Status: upstream.** `buildImportRows` returns `skipped` (`csv.ts:573`), listed by
  `describeSkippedRows` in the preview (`ImportModal.tsx:834`). Differences, minor:
  - uy-support left rows with **every amount cell empty** out quietly (balance lines like
    `,,Saldo inicial,,,,15919.26`); upstream lists them ("row 1, date (empty)"). Noise only.
  - uy-support read an amount cell of `-` as 0 ("Some banks fill empty debit and credit cells with
    a dash"); upstream does too for inflow/outflow (`sideAmount`), and lists `-` in a single amount
    column as skipped. Fine.

### 5. Conventions remembered per account

- **Change:** `csvImportConventions` device preference, by account id; later (`fcef4a2`) also the
  column mapping (reused when the headers are identical), `chargesPositive` and `otherAccountId`.
- **Commits:** `f39dbe0`, `fcef4a2` ("The column mapping and the card choices are remembered per
  account, next to Dates and Decimals."). PR #5 then moved it to the server ("A phone, another
  browser and a backup now all have them").
- **Status: upstream** for dates, decimals and columns: `ImportSettings` in `accounts.import_settings`
  (`csv.ts:495`, `columnRolesFor` `:522`, saved at `ImportModal.tsx:445`). The card choices:
  **spec #13** (`outPositive`) and **spec #12** (`otherAccounts`). PR #5's own column and shape:
  **don't port** (upstream's column replaces it; #11 fixes how to extend it).

### 6. Spanish column headers, accent-insensitive

- **Change:** header hints `fecha`, `descripcion`, `concepto`, `detalle`, `importe`, `monto`,
  `debito(s)`, `credito(s)`, `referencia` (`f39dbe0`), `notas`/`nota`, `beneficiario` (`5936ce4`),
  `imp. cuota`, `moneda`, `pesos`, `dolares`, `importe $`, `importe u$s`… (`fcef4a2`). Headers are
  matched lower-cased **with accents stripped** (`normalize('NFD')`) and spaces collapsed.
- **Why:** code comment "English and Spanish (Uruguayan banks) headers, lower case and without
  accents"; `5936ce4` "a transactions CSV exported in Spanish imports back".
- **Status: partly upstream, the rest not covered.** Upstream `COLUMN_HINTS` (`csv.ts:388`) has
  only `fecha`, `concepto` and `importe` for Spanish, and matches the header exactly (it lists
  `libellé` and `libelle` separately). Probe on upstream:
  `Descripción, Detalle, Débito, Débitos, Crédito, Créditos, Monto, Referencia, Notas` → all
  `skip`. So `windows-1252.csv` (`Fecha;Descripción;Débito;Crédito`) and Santander's statement
  stop at "At least one amount column is required" until mapped by hand.
  - Generic form: more Spanish words in the hint list, and accent/space-insensitive matching.
  - `beneficiario`/`notas` exist only for the fork's Spanish export: **don't port** (translation is
    out of scope).

### 7. Bank details above the header (Santander Uruguay)

- **Change:** `readTable`: the header is the first line naming a date column and an amount column;
  lines above it are the `preamble`, never imported.
- **Commit:** `714e31f`. **Why:** "A Santander Uruguay CSV could not be imported ("Date column is
  required"): The account's details (holder, number, currency, period) come before the column
  headers."
- **Status: upstream.** `detectSkipRows` (`csv.ts:108`, width-based, "some banks (DKB, Comdirect)
  start with account details") plus a "Rows above the header" field. Probe: Santander's statement
  (`bank-preamble-debit-credit.csv`) and card statement (`card-pesos-dolares-columns.csv`) →
  `skip: 5`, the right header row.

### 8. Latin-1 files

- **Change:** `decodeCsvBytes`: UTF-8, else Windows-1252.
- **Commit:** `714e31f`. **Why:** "The file is Latin-1, so "Número" showed as "N�mero". Files
  that are not valid UTF-8 are read as Windows-1252."
- **Status: upstream.** `decodeCsvBytes` (`csv.ts:148`, same rule plus BOMs and an Encoding select).

### 9. ⚑ Header with a column the rows leave out (Santander Uruguay)

- **Change:** `alignHeaders`: when every dated row is shorter than the header and a `payee` column
  holds nothing but numbers, that header is dropped (only if the amount columns then hold amounts).
- **Commit:** `714e31f`. **Why:** "Transaction rows leave out a column the header names, so the
  balance would have been read as the amount. The header is dropped when every dated row is
  shorter than the header and a payee column holds nothing but numbers." Test comment: "transaction
  rows with one cell fewer than the header (no "Descripción"), unlike the balance rows".
- **Status: not covered, and upstream imports wrong amounts silently.** Probe on upstream with
  `bank-preamble-debit-credit.csv` mapped by header name (Débito → Outflow, Crédito → Inflow):
  every row imports with the **balance as an inflow** (`DEBITO OPERACION…` +9,494.26, which is the
  balance; the real −6,425.00 sits under `Descripción`), nothing skipped. A user who maps by the
  sample cells instead of the header names gets it right, and the mapping is then saved under the
  wrong header names.
  - The rule is written around this one file (it looks for a numeric `payee` column). Needs a
    generic form, e.g. "every data row is one cell shorter than the header: say so and show cells
    by position", or a header-shift detection not tied to the payee role. Needs a spec.

### 10. Dates guessed from the lines above the header

- **Change:** the date-order guess also reads the preamble ("a statement's period often has a day
  above 12": `Desde: 01/10/2026 Hasta: 31/10/2026`).
- **Commit:** `714e31f`/`fcef4a2` (code comment in `showSheet`; test "finds the headers under the
  account details" guesses `day-first` from rows whose days are all ≤ 12).
- **Status: not covered.** Upstream's `detectDateFormat` looks only at the date column; probe:
  `['02/10/2026', '03/10/2026']` → `null`, so the dialog asks. That's upstream's "never guess",
  so nothing breaks; using the preamble as evidence is an optional nicety (and the first answer is
  saved per account anyway).

### 11. Amounts in the account's currency in the preview

- **Change:** the preview formats amounts in the account's currency.
- **Commit:** `8aae209` (no body).
- **Status: upstream.** `formatMoney(row.amount, currency)` (`ImportModal.tsx:888`).

### 12. Preview date and amount on one line

- **Change:** `whitespace-nowrap` on the preview's date and amount cells.
- **Commit:** `7db00c5` (no body). PR #1: "the import preview's date and amount cells no longer
  wrap".
- **Status: not covered** (upstream's cells at `ImportModal.tsx:876`/`:888` have no `nowrap`).
  Cosmetic; worth checking on a phone first.

### 13. "First row reads as …" under the mapping

- **Change:** under the column choices: "First row reads as **5 Mar 2026, $1,234.56**", so a wrong
  Dates/Decimals choice shows before Preview.
- **Commit:** `fcef4a2` (key `map.firstRow`); docs: "FlyBudget shows how the first row reads, so
  you can tell at a glance that the day and the amount are right." e2e: "a wrong date or decimal
  choice shows before anything is imported".
- **Status: not covered.** Upstream shows sample cells per column and the result only in the
  preview. Optional; it also helps with #13's sign flip and item 9.

### 14. "Purchases are positive in this file"

- **Change:** a box that turns every signed amount around (never inflow/outflow), **ticked
  automatically on credit accounts when most amounts are positive** (`guessChargesPositive`).
- **Commit:** `fcef4a2`. **Why:** "'Purchases are positive in this file' turns every sign around,
  and is guessed for credit card accounts." Test: "A Santander Uruguay card statement: … purchases
  written as positive amounts"; the Itaú test uses it too.
- **Status: spec #13** ("Flip amount signs"; never ticked automatically, an advice-only caution
  instead, saved as `outPositive`). The auto-tick: **don't port** (decided in #13).

### 15. ⚑ Two currencies in one file (Santander: a column each; Itaú: a currency column)

- **Change:** roles `amountUYU`/`amountUSD` (headers `Pesos`/`Dólares`, `Importe $`/`Importe U$S`)
  and `currency` (`Moneda`, cells `Pesos`/`Dólares`/`US$`/`U$S`… via `parseImportCurrency`); a
  "Currency" column only counts when its cells name pesos or dollars ("other banks use it for
  currencies this app doesn't hold, and those files import as before"); a row in another currency
  is a problem, never imported into this account; duplicates numbered per currency.
- **Commit:** `fcef4a2`. **Why:** "A card statement that lists both currencies (a column each, or
  one amount column and a currency column) is imported in one pass". Code: "`amountUYU` /
  `amountUSD` (a column each: Santander's `Pesos` / `Dólares`) or `currency` next to one amount
  (Itaú's `Moneda`…)".
- **Status: spec #12** (open). Hard-coded to UYU/USD and to Uruguayan words: #12 already asks for
  the generic form (ISO 4217 codes and symbols, no new roles in `columns` per #11). Upstream today
  (probe): `currency-column-other-bank.csv` imports as before (`Currency` → skip); Itaú's and
  Santander's card files stop at "At least one amount column is required".

### 16. ⚑ Itaú's instalment column `Imp. cuota`

- **Change:** header hint `'imp. cuota': 'amount'`.
- **Commit:** `fcef4a2`. **Why:** code comment "Itaú's card statement: the instalment charged this
  month ("Imp. total" is the whole purchase)"; test "The instalment charged this month, not the
  whole purchase" (`Heladera`, `1000` of `12000`, `1/12`).
- **Status: not covered.** Upstream guesses `skip` for both `Imp. cuota` and `Imp. total`, so the
  user picks; picking `Imp. total` would book the whole purchase every month. A bank's
  abbreviation in the hint list; generic form: hints for instalment headers (`cuota`,
  `importe cuota`, `instalment`…) and never `total` when an instalment column exists. Belongs with
  item 6's header hints (and #12 for the `Moneda` part of the same file).

### 17. Rows of the other currency go to another account

- **Change:** "Rows in dollars go to [account]", preselected only when exactly one account of the
  same type in the same Account Group holds that currency (`importDestination.ts`); one request per
  account; a partial-failure message.
- **Commit:** `fcef4a2` ("rows of the other currency go to the account chosen in the dialog,
  preselected only when one account of the same type in the same Account Group holds that
  currency").
- **Status: spec #12** (destination and `otherAccounts`) and **spec #16** (account groups as the
  default).

### 18. Excel `.xlsx`/`.xltx`/`.xlsm` and the Sheet picker

- **Change:** the app's own reader; number cells written under the Decimals choice, date cells as
  ISO; opens the first sheet with a recognised table, a Sheet select for the rest.
- **Commit:** `fcef4a2`. **Why:** ".xlsx, .xltx, .xlsm and .xls files are read in the browser by
  the app's own readers, with no new dependency." Code: "A workbook's transactions aren't always on
  its first sheet (Itaú's card summary)"; test "Like Itaú's statement: indented one column and
  three rows, text dates, real numbers".
- **Status: spec #14.** Note for #14's sheet rule ("the first where the column guess finds a date
  and an amount column"): with upstream's hints Itaú's sheet (`Fecha`, `Concepto`, `Imp. cuota`,
  `Moneda`) has **no amount column**, so the rule falls back to the first sheet, which is the
  summary. It only finds the right sheet once items 6 and 16 add Spanish/instalment hints.

### 19. Excel `.xls`

- **Commit:** `fcef4a2` (same quote). **Status: spec #15** (open).

### 20. Spanish in the import dialog and the server's CSV exports

- **Commits:** `fab585d`, `8f1c368` (dialog text and plural counts), `f0488a8` (export headers and
  file names follow `lang=es`), `5936ce4` (the Spanish export imports back).
- **Status: don't port** (Spanish translation is out of the map's scope).

### 21. Sample files

- **Commit:** `f22707f` ("Sample CSV files for testing imports, currencies and transfer suggestions
  by hand"). `testing-assets/import-formats/` and `two-currencies/` are the files used by the probe
  above, and #12 already points at `two-currencies/`. Worth carrying over as fixtures for items 6,
  9 and 16 (they hold no real data: "Perez Ana", "XXXXX-0000").

## Not covered by any spec (in scope)

1. **Item 9, header with a column the rows leave out (Santander Uruguay).** Upstream reads the
   balance as the amount without a warning when mapped by header name. Needs a generic rule. The
   most important one: it silently books wrong amounts.
2. **Item 6 + 16, Spanish header hints and accent-insensitive matching**, including instalment
   columns (Itaú's `Imp. cuota` vs `Imp. total`). Without them Uruguayan files need every column
   mapped by hand once per account, and #14's sheet choice can't find Itaú's transaction sheet.
3. **Item 10, date order from the lines above the header** (optional: upstream asks instead).
4. **Item 13, "First row reads as …"** line under the mapping (optional).
5. **Item 12, preview date/amount without wrapping** (cosmetic).

Covered elsewhere: items 1-5, 7, 8, 11 by upstream; 14 by #13; 15 and 17 by #12 (+ #16); 18 by #14;
19 by #15. Out of scope: item 20.
