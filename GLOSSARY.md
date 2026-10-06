# FlyBudget

A local-first, single-user budgeting app: money sits in accounts, transactions are categorized, and a monthly budget plans what each category gets.

## Language

### Accounts and currencies

**Account**:
One balance in exactly one currency, receiving transactions in that currency. A two-currency bank product is two accounts.
_Avoid_: Currency ledger, sub-account
_Spanish_: Cuenta

**Account Group**:
A named set of accounts shown together because they belong to the same real-world product, such as the pesos and dollars sides of one credit card. Groups are flat: there is no bank level above them, and an account may have no group.
_Avoid_: Bank, institution, multi-currency account
_Spanish_: Grupo de cuentas

**Currency**:
Either Uruguayan pesos (UYU, written `$`) or US dollars (USD, written `US$`). No other currencies exist.
_Spanish_: Moneda

**Home Currency**:
The currency the budget is planned in and that combined totals are shown in: Uruguayan pesos. It is fixed.
_Avoid_: Base currency, budget currency, local currency
_Spanish_: Moneda principal

**Native Amount**:
A transaction's or balance's amount in its own account's currency, as the bank reported it.
_Avoid_: Original amount
_Spanish_: Monto en su moneda

**Exchange Rate**:
Pesos per dollar on a given date, the interbank rate with no buy/sell spread. A date with no published rate uses the closest earlier one.
_Avoid_: Quote, cotización, FX rate
_Spanish_: Tipo de cambio

**Viewing Currency**:
The currency combined totals are displayed in on the dashboard, reports, cash flow and net worth: the home currency unless the user switches it. The budget is always in the home currency.
_Avoid_: Primary currency, display currency
_Spanish_: Moneda de visualización

**Converted Amount**:
A native amount expressed in another currency. A transaction converts at the exchange rate of its own date; a balance converts at the rate of the day it is shown for.
_Spanish_: Monto convertido

### Transactions

**Transfer**:
Two linked transactions in different accounts, money out of one and into the other, that count as neither spending nor income. Between accounts of different currencies each side keeps its own native amount.
_Avoid_: Internal transfer, exchange, currency purchase
_Spanish_: Transferencia

**Transfer Suggestion**:
A pair of unlinked transactions the app proposes as a transfer, which becomes one only when the user confirms it.
_Spanish_: Sugerencia de transferencia

### Display

**App Language**:
The language the app's own text is written in on one device: English or Spanish. It never changes anything the user typed or a bank reported (names, notes, payees) or how amounts are written.
_Avoid_: Locale, translation, idioma del presupuesto
_Spanish_: Idioma de la app

### Budget

**Default Category**:
A category, category group or report dashboard (the "Overview" one) whose name is one the app supplies, in either language. Its name is the app's own text, so each device shows it in its App Language. Renaming it makes it an ordinary one whose name is what the user typed; giving it a supplied name again makes it a default one again.
_Avoid_: Seeded category, built-in category, system category
_Spanish_: Categoría predeterminada
