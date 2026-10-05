# FlyBudget

A local-first, single-user budgeting app: money sits in accounts, transactions are categorized, and a monthly budget plans what each category gets.

## Language

### Accounts and currencies

**Account**:
One balance in exactly one currency, receiving transactions in that currency. A two-currency bank product is two accounts.
_Avoid_: Currency ledger, sub-account

**Account Group**:
A named set of accounts shown together because they belong to the same real-world product, such as the pesos and dollars sides of one credit card. Groups are flat: there is no bank level above them, and an account may have no group.
_Avoid_: Bank, institution, multi-currency account

**Currency**:
Either Uruguayan pesos (UYU, written `$`) or US dollars (USD, written `US$`). No other currencies exist.

**Home Currency**:
The currency the budget is planned in and that combined totals are shown in: Uruguayan pesos. It is fixed.
_Avoid_: Base currency, budget currency, local currency

**Native Amount**:
A transaction's or balance's amount in its own account's currency, as the bank reported it.
_Avoid_: Original amount

**Exchange Rate**:
Pesos per dollar on a given date, the interbank rate with no buy/sell spread. A date with no published rate uses the closest earlier one.
_Avoid_: Quote, cotización, FX rate

**Viewing Currency**:
The currency combined totals are displayed in on the dashboard, reports, cash flow and net worth: the home currency unless the user switches it. The budget is always in the home currency.
_Avoid_: Primary currency, display currency

**Converted Amount**:
A native amount expressed in another currency. A transaction converts at the exchange rate of its own date; a balance converts at the rate of the day it is shown for.

### Transactions

**Transfer**:
Two linked transactions in different accounts, money out of one and into the other, that count as neither spending nor income. Between accounts of different currencies each side keeps its own native amount.
_Avoid_: Internal transfer, exchange, currency purchase

**Transfer Suggestion**:
A pair of unlinked transactions the app proposes as a transfer, which becomes one only when the user confirms it.
