# FlyBudget

A local-first budgeting app: accounts, their transactions, and a zero-based budget built from them.

## Language

**Account Section**:
A name the user gives to some of their accounts so they're listed together, such as the two currency sides of one card or a set of rarely used accounts. An account is in at most one section, and the sections belong to the device, not the budget.
_Avoid_: Account group, account category, folder

**Budget List**:
One of the sidebar's two lists of accounts: For budget (counted in the budget) and Off budget. An Account Section can appear in both.
_Avoid_: Section, budget section

**Account Type Group**:
One of the six fixed families of account types (cash, credit, investments, property, loans, other) that the Accounts page is divided by.
_Avoid_: Account section
