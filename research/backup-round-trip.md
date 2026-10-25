# Backup round-trip check (issue #11)

Question: how does plain upstream FlyBudget treat the extra data `uy-compatibility` would add, and how do we test that a backup survives **this branch → plain upstream → this branch**?

Sources: upstream `main` at `12e6b93` (the base of `uy-compatibility`) and the `uy-support` branch (reference only). Every claim below was read in the code. The behaviour claims were also run against an in-memory server: a throwaway vitest probe based on `server/src/routes/importSettings.test.ts` and `backup.test.ts`, using `DB_PATH=:memory:`, which was not committed. Results are in the table at the end.

## Short answer

- **Restore accepts any text in `accounts.import_settings`.** It is a plain text column. Restore only checks that the value is a string of at most 1,000,000 characters. Extra keys, unknown column roles and even text that isn't JSON are stored exactly as written. A backup taken afterwards gives back the same string. The backup format itself is the hard limit: never bump `BACKUP_VERSION` (3) on this branch, or upstream will refuse the file.
- **Upstream reads the stored settings strictly.** Extra keys are dropped when the settings are read. A single unknown column role makes the whole CSV settings `null`: the account forgets them, and the import dialog guesses and asks again. `statementAccount` is read separately, so it survives either way.
- **Upstream rewrites the column after every import into that account.** A CSV import replaces the settings with upstream's shape, which erases this branch's keys. A CAMT import keeps only what upstream can read. If the CSV settings had an unknown role, a CAMT import leaves just `{"statementAccount": …}`, and the CSV settings are erased too. Nothing is rewritten while the user only views or restores data; only imports write it.
- **Design rule that follows:** this branch must **never put a new role inside `columns`**. Columns with a new meaning should be stored as an upstream role (`amount` or `skip`), and the extra meaning should go in new optional top-level keys. Then upstream reads the settings fine and drops only the extras. Back on this branch, a missing extra key means "not known, guess or ask", never "false".
- **The server validator** can then be upstream's `importSettingsSchema` `.extend()`ed with optional keys. Every body upstream accepts is still accepted, and gives the same result.
- **Device preferences are not in backups.** A backup holds database tables only, and preferences live in the browser's `localStorage` (`budget-preferences`). Account groups and a second currency kept as preferences are lost when moving to another device or browser, or to another origin (host or port). They do survive a restore on the same device, because restore keeps account ids.
- **Round-trip check:** (1) a fast server property test on this branch that checks the superset against a pinned copy of upstream's schema and replays upstream's re-save; (2) an optional CI job that restores this branch's fixture backup into the published upstream Docker image, exports it again, and restores the result back into this branch.

## 1. Restore and `accounts.import_settings`

`server/src/db/schema.ts:30`: `importSettings: text('import_settings')` (nullable, no default).

`parseBackup` (`server/src/services/backupService.ts`):

- Line 99 refuses a backup whose `version` is higher than `BACKUP_VERSION` (3) with "This backup was made by a newer version of FlyBudget". **This branch must keep `BACKUP_VERSION = 3`**, so every change has to fit inside the existing tables and columns (this matches the map's no-schema-change rule).
- Lines 120-135 copy only the columns the schema knows. Extra row keys (for example `groupName` from `uy-support`), extra tables and extra top-level keys are dropped without an error (the comment on line 85 says so).
- Line 132: a text column only has to be a string of at most 1,000,000 characters. Its content is not checked, so `import_settings` is opaque to restore.

Verified: a v3 backup whose accounts carried (a) valid settings plus `chargesPositive` and `otherAccounts`, (b) the role `'amount:USD'` and the role `'currency'`, and (c) the string `not json at all` restored with 200. `GET /export/backup` then returned the same three strings unchanged. The extra `groupName` column and the `futureTable` table were dropped.

## 2. Reading settings (`readImportSettings`)

`server/src/utils/importSettings.ts`:

- `importSettingsSchema` (line 27) is a `z.object` and Zod 4 strips unknown keys by default (`server/package.json`: `zod ^4.6.7`). So **extra keys are dropped** when the settings are read.
- `columns` must be `[header, role]` pairs with `role` in `COLUMN_ROLES` (`date payee amount inflow outflow direction notes skip`, line 41). One unknown role fails the whole parse, so `readImportSettings` (line 75) returns **`null` for all CSV settings**: delimiter, encoding, rows to skip and the formats are all forgotten, not just that column.
- `readStatementAccount` reads `statementAccount` from the raw JSON on its own, so it **survives** settings that can't be read.

Verified: `GET /accounts/:id/import-settings` returned the core settings without the extras for (a), `{settings: null, statementAccount: "UY123"}` for (b), and `{settings: null, statementAccount: null}` for (c).

What an upstream user sees: for (a), nothing changes; upstream imports exactly as it would without the extras. For (b), the next import into that account guesses everything again, as on a first import. Neither case is an error.

## 3. Does upstream's re-save erase this branch's keys?

Yes, but only when an import into that account is saved. `storeImportSettings` (line 87) builds the new value from what upstream understands:

```ts
const settings = change.settings ?? readImportSettings(stored);
const statementAccount = change.statementAccount ?? readStatementAccount(stored);
return JSON.stringify({ ...settings, ...(statementAccount ? { statementAccount } : {}) });
```

- `PUT /accounts/:id/import-settings` (`routes/accounts.ts:223`) parses the body with the same stripping schema and replaces the settings. Any extra key in the body or in the stored value is gone. The client calls it after every CSV import that has a date order and a number format (`rememberSettings`, `client/src/components/transactions/ImportModal.tsx:429`, called at line 490).
- `PUT /accounts/:id/statement-account` (line 232; the client calls it after a CAMT import) re-serializes the stored CSV settings through `readImportSettings`. Extras are dropped, and **settings that can't be read are erased entirely**.

Verified: after a statement-account PUT, (a) was stored as the core settings plus the new `statementAccount` (extras gone), and (b) was stored as just `{"statementAccount":"UY999"}`. A settings PUT with `chargesPositive`/`otherAccounts` in the body answered 200 and stored neither. A settings PUT with the role `currency` answered 400.

So after a stay on upstream that included imports, this branch has to handle settings without its keys. Section 4's rule (absent = unknown) covers that. Data is never corrupted: the worst case is that the dialog asks again.

## 4. What this branch's validator needs, as a superset of upstream

Store everything this branch adds as **optional top-level keys**, and keep `columns` limited to upstream's roles:

| Need (from `uy-support`)                    | How `uy-support` stored it                                                                                                     | How to store it here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purchases written as positive amounts       | `chargesPositive?: boolean` in localStorage `csvImportConventions` (`client/src/utils/csv.ts` on `uy-support`, `ImportMemory`) | `chargesPositive: z.boolean().optional()`. Absent means "unknown, guess", as `uy-support` already did (`memory?.chargesPositive ?? <guess>`).                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Where the other currency's rows go          | `otherAccountId?: string \| null` (one other currency)                                                                         | Per currency, generic: `otherAccounts: { [ISO 4217 code]: accountId \| null }`, optional. Validate the codes against `utils/currencies.ts`. Read it with the same `Object.entries` → `Object.fromEntries` trick `columns` uses, so a key named `__proto__` is safe. Treat an id that is unknown or closed as "not chosen": upstream never cleans these up (accounts are only soft-closed, `routes/accounts.ts:276`), and a restore can bring in other accounts.                                                                                                        |
| Columns per currency, and a currency column | The roles `amountUYU`, `amountUSD` and `currency` in `ColumnRole` (country-specific)                                           | In `columns`, store the column as an upstream role: the budget-currency amount column as `amount`, the other-currency amount column and the currency column as `skip`. Put the real meaning in an optional key such as `columnCurrencies: { [header]: ISO code }` plus `currencyColumn: header \| null`, parsed the same way as `columns`. Then upstream imports the budget-currency column and lists the other-currency rows as skipped (amount 0) in its preview, which is visible and harmless. It does not drop the whole settings. Decide the exact shape in #12. |

Schema sketch (server, in `utils/importSettings.ts`):

```ts
export const importSettingsSchema = upstreamImportSettingsSchema.extend({
  chargesPositive: z.boolean().optional(),
  otherAccounts: currencyKeyedRecord(accountIdOrNull).optional(),
  columnCurrencies: headerKeyedRecord(currencyCode).optional(),
  currencyColumn: z.string().max(200).nullable().optional(),
});
```

Properties this keeps:

- Every body that upstream accepts is accepted here, with the same parsed core, and gives the same answer (no new required keys, no change to `COLUMN_ROLES`).
- A value this branch writes always passes upstream's `readImportSettings`, so upstream keeps the delimiter, encoding and formats.
- Keep the key names plain and descriptive, not prefixed like `x-uy-`, so they can be offered upstream unchanged. There is a small risk that upstream later adds a key with the same name and a different meaning; the pinned-schema test in section 6 is where that would show up.
- `statementAccount` stays reserved for upstream's use.
- Keep `client/src/utils/csv.ts` `ImportSettings` in sync (upstream's comment on line 493 asks for this).

A possible small upstream improvement (offer it politely, it is not needed): `storeImportSettings` could keep the stored keys it doesn't understand when only `statementAccount` changes, instead of rebuilding the value from `readImportSettings`. Then a CAMT import would never erase CSV settings it can't read. This is a judgment call for the maintainer: today's behaviour is deliberate cleanup and is tested ("ignores stored settings in an old or broken shape").

## 5. Device preferences (account groups, second currency)

- Backups hold the `BACKUP_TABLES` only (`backupService.ts`, `TABLES`). Preferences live in the zustand `persist` store `budget-preferences` in `localStorage` (`sessionStorage` in the demo) (`client/src/store/preferencesStore.ts`). **They are not in backups**, not in the offline copy (which holds query data), and not on the server.
- What is lost when moving to another device, browser or installation: account groups, the open/closed state of groups, a second "viewing" currency, `currencyStyles`, amount format and symbol position, theme, the date format, and every other preference. Restoring the same backup on the **same device and origin** keeps account groups that are keyed by account id, because restore keeps ids.
- **Origin matters:** `localStorage` is per origin. The desktop app always uses `http://localhost:58342` (`electron/main.ts:13,22`), so switching between an upstream build and a fork build on the same machine shares preferences. For self-hosted installs, the fork's Docker setup on `uy-support` moved to port 3002 (`e69500f`), which is a different origin from upstream on 3001. Preferences don't carry over between the two.
- **Same origin, both builds:** upstream keeps preference keys it doesn't know. It has no `partialize`, zustand's default merge is shallow, and `migratePreferences` (line 75) only adds keys for `version < 1`. But zustand runs `migrate` whenever the stored version **differs**, including going down a version (`zustand/esm/middleware.mjs:392`). If this branch bumps `PREFERENCES_VERSION` to 2, a visit with upstream rewrites the stored version to 1, and this branch then runs its `version < 2` step again. **Every migration step this branch adds must be safe to run again and must not overwrite a value that is already set.**
- In `uy-support`, account groups were a **database column** (`accounts.group_name`, `uy-support:server/src/db/schema.ts:38`, plus `server/src/utils/accountGroups.ts`). That can't be ported as it was: upstream drops it on restore (verified: `groupName` disappeared).

## 6. A repeatable round-trip check

### a) Server property test on this branch (fast, runs in CI with every `npm test`)

`server/src/routes/importSettingsRoundTrip.test.ts`:

1. **Pinned upstream schema.** Add `server/src/utils/upstreamImportSettings.fixture.ts`: a copy of upstream's `importSettingsSchema`, `readImportSettings` and `storeImportSettings` at the fork point, with a comment naming the upstream commit. Update it when merging upstream, and the diff will show any change upstream made.
2. **Superset (fast-check):** for any settings upstream accepts, this branch's schema accepts them and gives the same parse. For any settings this branch's writer produces, including every new key, the upstream schema parses them successfully (never `null`) and gives the same core.
3. **Restore keeps them:** restore a v3 backup whose accounts carry generated settings with all the new keys. `GET /export/backup` must return the same `importSettings` strings, and `GET /accounts/:id/import-settings` must return them with every new key.
4. **Simulated upstream visit:** run the stored value through the pinned upstream `storeImportSettings` (once with `{settings: upstreamRead}` for a CSV import and once with `{statementAccount}` for a CAMT import), restore the result on this branch, and assert that it reads without error, keeps the core fields, and treats the missing extras as unknown (the import dialog asks again rather than defaulting `chargesPositive` to false).
5. **Version guard:** `createBackup().version === 3`, so a bump fails this test instead of silently breaking upstream restores.

This is a few hundred lines in the existing style, modelled on `routes/importSettings.test.ts` (an express app with `accountsRouter` and `exportRouter`) and `routes/backup.test.ts` (`fc.asyncProperty`, `numRuns: 10`).

### b) Real cross-version job (optional, slower, CI only)

A workflow step after the existing Docker smoke test (`.github/workflows/docker.yml` already sets up a server-mode instance, reads the setup code from the log and signs in):

1. Start this branch's image and restore `e2e/fixtures/round-trip-backup.json`, a committed file with the new keys and covering each case in section 4.
2. Start the **published upstream image** (`ghcr.io/dtymoszenko/flybudget:latest`, or the upstream version this fork is based on) the same way, `POST /api/export/restore` the backup exported in step 1, and export it again. Assert that it answered 200 and that `accounts[].importSettings` came back unchanged.
3. Restore that file into this branch's image and compare it with the backup from step 1 (ignoring `exportedAt`). Also check `GET /accounts/:id/import-settings`.

This proves the claim against real upstream code. Test (a) only proves it against the pinned copy. Run it on tags (`v*-uy.N`) or once a week, so a run doesn't depend on upstream's `latest` changing during a PR.

An e2e (Playwright) version is possible, using `POST /api/export/restore` through the `api` fixture, but it only exercises this branch's code. Test (a) covers the same ground faster.

## Probe results (upstream `main` 12e6b93, in-memory server)

| Probe                                                                                         | Result                                                          |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Restore v3 with extra keys, unknown roles and non-JSON in `import_settings`                   | 200; all three strings stored and exported exactly              |
| Restore with an extra account column (`groupName`), an extra table and an extra top-level key | 200; all dropped without an error                               |
| `GET import-settings`, extras only                                                            | core settings returned, extras dropped, `statementAccount` kept |
| `GET import-settings`, unknown role                                                           | `settings: null`, `statementAccount` kept                       |
| `PUT statement-account`, extras only                                                          | stored = core + new `statementAccount`; extras erased           |
| `PUT statement-account`, unknown role                                                         | stored = `{"statementAccount":"UY999"}`; CSV settings erased    |
| `PUT import-settings` with extra keys in body                                                 | 200; extras stripped from response and storage                  |
| `PUT import-settings` with role `currency`                                                    | 400                                                             |
| Restore `version: 4`                                                                          | 400 "This backup was made by a newer version of FlyBudget"      |
