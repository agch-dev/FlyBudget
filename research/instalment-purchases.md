# How budgeting apps handle instalment purchases

Research for [issue #21](https://github.com/agch-dev/FlyBudget/issues/21): should FlyBudget record an instalment card purchase (UY/AR "cuotas", BR "parcelas", MX "meses sin intereses", US "Pay Over Time", BNPL) as **(1) the full price once**, or **(2) each month's instalment, with the plan tracked (e.g. as a schedule with an end date) and a remaining-total figure**?

Researched 2026-10-25. Sources are official help centres, source code and official issue trackers. Where an app documents nothing, it says "not documented". Community workarounds are labelled as such.

## Background: what the bank does

Card issuers in both regions take the full price off the available credit when the purchase is made, then bill one instalment per statement.

- **Nubank (BR)**: you need enough limit for the full price, not just one parcela ([community, snippet only](https://comunidade.nubank.com.br/t/posso-fazer-compra-parcelada-com-valor-maior-que-o-limite/331369)). "Antecipar parcelas" pulls future parcelas into the current fatura at a discount, and paying them frees the limit ([Nubank blog](https://blog.nubank.com.br/antecipar-compras-parceladas-no-cartao/)).
- **Chase Pay Over Time (US)**: the purchase posts in full. The plan's "monthly payment which includes the monthly principal and monthly fee will be automatically added to your card's minimum payment due each month", and paying the full statement balance pays the plan off early ([Chase FAQ](https://www.chase.com/personal/credit-cards/chasepayovertimesocial/faqs/after-purchase)).
- **Apple Card via Monarch (US)**: the synced "Total Balance" "Includes Apple Card Monthly Installments" ([Monarch help](https://help.monarch.com/hc/en-us/articles/24178098173076-Syncing-Your-Apple-Card-Cash-and-Savings)).

So in US plans and US data feeds, the card balance is everything owed. LatAm statements also put each month's cuota on its own line ("Cuota 2/6", "Parcela 3/10"). That line is the "1 row per month" problem from #21.

## YNAB

- **(a)** YNAB gives no instalment feature. Card purchases are recorded in full on the card account, as for any card purchase. For BNPL it recommends "dedicated categories for each of your BNPL programs" and says "The loan account type isn't a good fit for this type of debt, and it can be complicated to set up in your existing Cash or Credit accounts" ([YNAB: Managing BNPL](https://support.ynab.com/en_us/managing-buy-now-pay-later-purchases-in-ynab-an-overview-BJrmfNdVj)).
- **(b)/(e)** There is no total owed and no list of plans. You track the plan by hand in a category note ("Total Purchase Amount / Installment Amount / Total # of Installments / Installments Remaining / Next Payment Date / Payoff Date"), "update the remaining installments … on a regular basis", and add a target so you remember to fund each instalment ([same article](https://support.ynab.com/en_us/managing-buy-now-pay-later-purchases-in-ynab-an-overview-BJrmfNdVj)).
- **Card plans** (Plan It, Pay Over Time, Flex Pay) are not named anywhere. The overspending article groups "Promotional 0% offers on individual purchases" with BNPL as needing "some additional setup" ([YNAB: intentional credit card overspending](https://support.ynab.com/en_us/intentional-credit-card-overspending-an-overview-HJrSQbOC9)).
- **(c)/(d)** Not documented for instalment lines.
- **Workaround (community, unverified)**: Amex Plan It as a debt account for the total plus an envelope for the monthly amount ([Goodbudget forum](https://forums.goodbudget.com/t/how-to-manage-credit-card-payment-plans/1903)). I couldn't check Reddit threads (blocked to the crawler).

## Actual Budget (open source)

- **(a)** There is no instalment feature. Two requests were auto-closed under the "needs votes" policy, which means "vote on it", not "rejected":
  - [#4481](https://github.com/actualbudget/actual/issues/4481) "Add proper installment handling": linked partial payments made from one transaction, with "the total sum of the transaction" counted for envelope budgeting.
  - [#4959](https://github.com/actualbudget/actual/issues/4959) (Brazil): current/total instalment fields.

  Related: [#520](https://github.com/actualbudget/actual/issues/520) (an instalments condition for rules) and [#6314](https://github.com/actualbudget/actual/issues/6314) (show the occurrence number "(02/05)" in notes through rule templating).

- **Schedules can end.** PR [#1899](https://github.com/actualbudget/actual/pull/1899) "Add schedule end date/count field" (merged 2023-12) added `endMode: 'never' | 'after_n_occurrences' | 'on_date'` with `endOccurrences` / `endDate` ([schedule.ts](https://github.com/actualbudget/actual/blob/master/packages/loot-core/src/types/models/schedule.ts)). Users use this as the instalment workaround: a schedule for the cuota amount that ends after N occurrences. The [schedules docs](https://actualbudget.org/docs/schedules) don't mention end dates.
- **(b)/(e)** No remaining-total figure and no list of plans. The schedules page shows the next date and the amount per occurrence ([docs](https://actualbudget.org/docs/schedules)).
- **(c)** A card is an ordinary account, and its balance is the sum of its transactions. The [credit card docs](https://actualbudget.org/docs/budgeting/credit-cards/) cover paying in full and carrying debt, with nothing on instalments. In [#1142](https://github.com/actualbudget/actual/issues/1142), Brazilian users say that model doesn't fit their statement cycles.
- **(d)** The only instalment-aware code is Pluggy.ai bank sync (Brazil). PR [#8380](https://github.com/actualbudget/actual/pull/8380) (merged 2026-07) maps a corrected date, purchase date + (instalment number − 1) months. Each instalment still arrives as its own transaction. CSV/OFX import has nothing for "2/6" text. Duplicate detection matches the same amount near the same date ([import docs](https://actualbudget.org/docs/transactions/importing#avoiding-duplicate-transactions)), so monthly cuotas aren't treated as duplicates of each other.

## Firefly III (open source)

- **(a)** The maintainer answers both ways:
  - [#574](https://github.com/firefly-iii/firefly-iii/issues/574): "Firefly cannot automatically track these payments for you. You should add the charges separately as they come in."
  - [#548](https://github.com/firefly-iii/firefly-iii/issues/548) (Brazil) depends on what the card shows. If the card's balance is the full amount, record one withdrawal for the full price and fill the gap with N transfers. If only the instalment appears each month, record a monthly withdrawal and match it to a bill.
- **Open request**: [#10073](https://github.com/firefly-iii/firefly-iii/issues/10073) "Support for monthly installments on credit card transactions" asks to "See the total remaining balance and how many installments are left". In [#8403](https://github.com/firefly-iii/firefly-iii/issues/8403) an Argentine user describes 6 interest-free cuotas of ARS 80,000; the card's "payment plan" field is "just a visual indicator".
- **Recurring transactions** can end: the model has `repeat_until` and `repetitions` ([Recurrence.php](https://github.com/firefly-iii/firefly-iii/blob/main/app/Models/Recurrence.php)). The [how-to](https://docs.firefly-iii.org/how-to/firefly-iii/finances/recurring/) doesn't mention it. In [discussion #7914](https://github.com/orgs/firefly-iii/discussions/7914), the maintainer suggests "a recurring transaction with a limited number of runs".
- **(b)/(e)** No per-plan remaining amount. The workaround (community, [#4972](https://github.com/orgs/firefly-iii/discussions/4972), #7914) is one **liability** per purchase. Liabilities (loan/debt/mortgage) show an amount due, but "Credit cards are not considered a liability" ([liabilities how-to](https://docs.firefly-iii.org/how-to/firefly-iii/finances/liabilities/)).
- **(d)** The data importer has nothing for instalments. Duplicate detection compares transaction content ([duplicates](https://docs.firefly-iii.org/how-to/data-importer/import/duplicates/)).

## Monarch Money, Copilot, Lunch Money

- **Monarch**: BNPL and instalment handling is not documented (searched its help centre for "buy now pay later", "installment", "Affirm"). Synced Apple Card balances include monthly instalments ([Apple Card](https://help.monarch.com/hc/en-us/articles/24178098173076-Syncing-Your-Apple-Card-Cash-and-Savings)). The closest features are Pay down goals for debts ([Goals](https://help.monarch.com/hc/en-us/articles/44373110771860-Goals-in-Monarch)) and recurring bills.
- **Copilot**: BNPL is not documented. The Apple Card "total balance … includes any yet-to-be-paid monthly installments" ([Apple Card](https://help.copilot.money/en/articles/9038131-apple-card-apple-cash-and-savings)). Recurrings show "paid and left to pay recurrings for the current month", with no plan totals ([Recurrings tab](https://help.copilot.money/en/articles/9778259-recurrings-tab-overview)).
- **Lunch Money**: no instalment feature. Two things come close:
  - A transaction "can be split evenly, in custom amounts, or in equal payments over time", and each part becomes its own transaction ([transaction types](https://support.lunchmoney.app/finances/transactions/transaction-types)).
  - Recurring items have an optional "active period" with a start and end date, so an end-dated recurring item is the natural workaround ([Basics of Recurring](https://support.lunchmoney.app/finances/recurring-items/the-basics-of-recurring)). A recurring item matches imported rows with the same payee and amount within a window of days ([creating recurring items](https://support.lunchmoney.app/finances/recurring-items/creating-recurring-items)).

  No remaining total is documented.

## Brazil: Mobills and Organizze

These are the only apps with a first-class instalment entry, and both use the per-instalment model.

- **Mobills** ([manual card instalments](https://mobills.zendesk.com/hc/pt-br/articles/44243003508123)):
  - **(a)** You enter the full price and the number of parcelas. "O Mobills criará automaticamente todas as parcelas, distribuídas nas faturas futuras do cartão", each labelled "1/10, 2/10…".
  - Edits apply to "somente esta despesa" or "esta despesa e as futuras".
  - **(c)** Future parcelas "ainda não afetam o limite total do mês atual". The bank, by contrast, blocks the full price.
  - **Anticipation**: you pick the target fatura and can enter a discount, which becomes a credit ([anticipation](https://mobills.zendesk.com/hc/pt-br/articles/4405267061787)).
  - **(d)** On cards synced through Open Finance, transactions come only from the bank and can't be created, edited or linked to manual ones ([same article](https://mobills.zendesk.com/hc/pt-br/articles/44243003508123), [Open Finance](https://mobills.zendesk.com/hc/pt-br/articles/17288982976539)).
  - **(b)/(e)** Not documented.
- **Organizze**:
  - **(a)** "Parcelado" splits a total into N entries. When the split isn't exact, "a sobra será somada à primeira parcela" ([parcelado](https://ajuda.organizze.com.br/hc/pt-br/articles/5663076876691), [rounding](https://ajuda.organizze.com.br/hc/pt-br/articles/6491899300371)).
  - **(d)** Most banks don't send future parcelas through Open Finance; "As instituições que importam as faturas de meses futuros são: Nubank, Itaú e Mercado Pago". Duplicates with manual entries: "basta conciliá-los para não haver duplicidade", i.e. the user reconciles them by hand ([bank connection](https://ajuda.organizze.com.br/hc/pt-br/articles/34229891699475)). Imports offer a manual "Transação duplicada" delete ([OFX](https://ajuda.organizze.com.br/hc/pt-br/articles/5994104693395)).
  - **(b)/(e)** Not documented.

## Spain, Argentina, Uruguay, Mexico

- **Fintonic**: tracking of aplazar / pago a plazos is not documented. Its pages cover only Fintonic's own lending, e.g. [0% Amazon financing](https://www.fintonic.com/blog/fintonic-collaborates-with-amazon-in-spain-to-fund-interest-free-purchases/).
- **Ualá (AR)**: past card spends can become 1/3/5 cuotas, listed under "Créditos > Consumos en cuotas". This is the only active-plans list found, and it comes from the press, not Ualá's help centre ([iProUP](https://www.iproup.com/finanzas/15211-cuotas-con-uala-alcance-funcionamiento-y-que-limites-tiene)).
- **Mercado Pago (AR)**: card cuotas are not documented. Its own credit line has 1–12 fixed cuotas with due dates under "Créditos" ([Ámbito](https://www.ambito.com/informacion-general/mercado-credito-todo-lo-que-tenes-que-saber-comprar-cuotas-usar-tarjeta-n5797192)).
- **BBVA México (MSI)**: per an unofficial FAQ, a purchase shows that it's deferred to MSI with its months and monthly amount ([FAQ](https://www.clubmitsubishiasx.com/faq/como-pasar-una-compra-a-meses-sin-intereses-bbva)).
- **OCA (UY)**, **Money Lover**, **Wallet (BudgetBakers)**, **Money Manager (Realbyte)**, **Cuanto**, **Fiwind**: instalment features not documented. Money Lover's Credit Wallet and Realbyte's help cover only the statement and payment dates ([Realbyte](https://help.realbyteapps.com/hc/en-us/articles/360046340034)).

## Comparison

| App               | Full vs per-instalment                                                 | Total owed shown?                              | Plans list?                        | Import handling of instalment lines                                     |
| ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| YNAB              | Full on card (BNPL: per-instalment via a dedicated category)           | No (manual category note)                      | No (category group as a stand-in)  | Not documented                                                          |
| Actual Budget     | Per-instalment (schedule ending after N runs, workaround)              | No                                             | No (schedules show next date only) | Each instalment imported; Pluggy (BR) fixes dates; no "n/N" parsing     |
| Firefly III       | Either, depending on the card (maintainer)                             | Only via a liability per purchase (workaround) | No (feature request #10073 open)   | Nothing special; content-based dedup                                    |
| Monarch           | Full (synced balance includes instalments)                             | Not documented                                 | Not documented                     | Follows the aggregator feed                                             |
| Copilot           | Full (Apple Card balance includes instalments); BNPL not documented    | No                                             | No                                 | Follows the aggregator feed                                             |
| Lunch Money       | Per-instalment ("equal payments over time" split; end-dated recurring) | No                                             | No                                 | Recurring item matches payee + amount near the date                     |
| Mobills (BR)      | Per-instalment, generated from full price ("1/10")                     | Not documented                                 | Not documented                     | Synced cards: bank data only, no linking to manual entries              |
| Organizze (BR)    | Per-instalment, generated from full price                              | Not documented                                 | Not documented                     | Manual reconcile / "duplicada"; only Nubank/Itaú/MP send future faturas |
| Nubank (bank)     | Full price blocks the limit; billed per parcela                        | Per purchase (anticipate screen)               | Per purchase                       | n/a                                                                     |
| Ualá (AR)         | Per-cuota                                                              | Yes (press)                                    | Yes: "Consumos en cuotas" (press)  | n/a                                                                     |
| Fintonic / others | Not documented                                                         | Not documented                                 | Not documented                     | Not documented                                                          |

## Dominant patterns

1. **Nobody tracks a plan's remaining total well.** No budgeting app documents a total owed per plan or across plans. Open-source users ask for exactly that ([Actual #4481](https://github.com/actualbudget/actual/issues/4481), [Firefly #10073](https://github.com/firefly-iii/firefly-iii/issues/10073)), and YNAB's official answer is a hand-maintained note. This is an open gap for FlyBudget.
2. **US apps and feeds record the full price.** The card balance equals everything owed, and the plan only changes the minimum payment (Chase; Apple Card in Monarch and Copilot). Brazilian apps record per instalment, generating N "n/N" entries from the full price. Their card balance then matches each fatura, not the limit the bank blocks (Mobills).
3. **Open-source apps use end-dated recurring items as the workaround** (Actual `after_n_occurrences`, Firefly `repetitions`, Lunch Money active period). None shows a remaining sum, so FlyBudget's "schedule with end date" idea matches what users already do, but it would need the missing piece: the remaining total (instalments left × amount) and a list of active plans.
4. **Imports mostly ignore the "n/N" counter.** Dedup is generic: by id, or by amount and date. Only Actual's Pluggy sync uses the instalment number, and only to fix the date. Banks that send future faturas (Nubank, Itaú, Mercado Pago, via Open Finance) are the exception that creates duplicate risk, which Organizze leaves for the user to reconcile.
