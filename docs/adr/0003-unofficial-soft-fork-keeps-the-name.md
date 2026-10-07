# Stay an unofficial soft fork that keeps the FlyBudget name

This repository is a fork of [FlyBudget](https://github.com/dtymoszenko/FlyBudget) that adds pesos and dollars, exchange rates and Spanish. FlyBudget's own roadmap includes multiple currencies, so this fork may become obsolete. Until a deliberate cutover it stays a soft fork: upstream is merged in regularly, and every identifier that would turn those merges into conflicts keeps upstream's name. The env vars (`FLYBUDGET_*`), cookies, the language header, IndexedDB names, `appId`/`productName`, release file names and the brand inside the app all stay "FlyBudget". What separates the fork from the original lives where users look for it: the README (an unofficial-fork banner recommending the original, and a section on what the fork adds), `SECURITY.md`, the source and issues links in the app (`client/src/utils/project.ts`, as AGPL section 13 requires for a modified version run for others), package metadata, and its own releases and Docker image (`ghcr.io/agch-dev/flybudget-fork`). The user guide in `website/` is not deployed from the fork, so the app's "Learn more" links keep opening the original guide.

## Considered Options

- **A new name across the code.** It would cleanly separate the two apps, but every upstream merge would conflict on every renamed identifier. A name of its own also suggests a lasting product, which this fork is not meant to be.
- **A new name in the README only, such as "FlyBudget UY".** Rejected for now: that name looks official, which is up to the upstream maintainer.
- **A hard fork right away.** Rejected while upstream fixes are still worth having.

## Consequences

- Renaming `appId` or `productName` later moves the desktop app's data folder (`budget.db`, `credentials.key`), so existing installs would open an empty budget. A rename at the cutover needs a step that moves that folder.
- The fork's CLA workflow is switched off in the repository settings rather than removed, and `CLA.md` stays upstream's. The fork doesn't take contributions.
- The README, `SECURITY.md`, the Docker workflow and `project.ts` differ from upstream, so merges conflict there. Keep the fork's changes to those files small.
