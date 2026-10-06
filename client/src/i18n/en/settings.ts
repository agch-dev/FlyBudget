import type { BudgetType, PlaidSyncStatus } from '../../types';
import type { SidebarMode, Theme } from '../../store/preferencesStore';

// Settings: every tab, and the bank connections (Plaid and SimpleFIN) it sets up.
export default {
  title: 'Settings',
  /** The tabs, keyed by the `?tab=` id */
  tabs: {
    categories: 'Categories',
    accounts: 'Accounts',
    connections: 'Connected Banks',
    data: 'Data',
    preferences: 'Preferences',
    rates: 'Exchange rates',
    server: 'Server',
  },
  /** `<license>` links to the license */
  license: 'FlyBudget is free software under the <license>GNU AGPL v3</license>.',
  sourceCode: 'Source code',
  loading: 'Loading…',
  save: 'Save',
  saving: 'Saving…',
  categories: {
    section: {
      income: 'Income',
      expense: 'Expenses',
    },
    createGroup: 'Create group',
    groupName: 'Group name...',
    addGroup: 'Add group',
    noGroups: 'No groups yet.',
    dragGroup: 'Drag to reorder group',
    edit: 'Edit',
    delete: 'Delete',
    noCategories: 'No categories yet.',
    createCategory: 'Create Category',
    categoryName: 'Category name...',
    addCategory: 'Add category',
    pickIcon: 'Pick icon',
    searchEmoji: 'Search emoji...',
    dragCategory: 'Drag to reorder {{name}}',
    editNamed: 'Edit {{name}}',
    deleteGroupTitle: 'Delete Group',
    deleteGroupMessage: 'Delete "{{name}}" and all its categories? This cannot be undone.',
    deleteCategoryTitle: 'Delete Category',
    deleteCategoryMessage: 'Delete "{{name}}"? This cannot be undone.',
    /** Deleting a category that has transactions */
    reassign: {
      intro_one:
        '<strong>{{name}}</strong> has <strong>{{count}}</strong> transaction. Choose a category to reassign it to before deleting.',
      intro_other:
        '<strong>{{name}}</strong> has <strong>{{count}}</strong> transactions. Choose a category to reassign them to before deleting.',
      budgetRemoved: 'Budget allocations for this category will be removed.',
      moveTo: 'Move transactions to',
      select: 'Select a category...',
      confirm: 'Reassign & Delete',
    },
    editTitle: 'Edit Category',
    iconAndName: 'Icon & Name',
    changeIcon: 'Change icon',
    nameLabel: 'Category name',
    group: 'Group',
    budgetType: 'Budget Type',
    /** What each budget type is for (its name is `budget:budgetType`) */
    budgetTypeHint: {
      fixed: 'Consistent, predictable monthly amount',
      flexible: 'Variable spending that changes each month',
      non_monthly: 'Periodic or irregular expenses',
      savings: 'Savings goals and investment contributions',
    } satisfies Record<BudgetType, string>,
  },
  accountOrder: {
    title: 'Account Order',
    description: 'Drag to reorder accounts in the sidebar.',
    empty: 'No accounts yet. Add one from the Accounts page.',
    onBudget: 'On Budget',
    offBudget: 'Off Budget',
    drag: 'Drag to reorder {{name}}',
  },
  data: {
    title: 'Data Export',
    description: 'Download your data for backup or analysis.',
    transactions: {
      title: 'Export Transactions',
      description:
        'Download all transactions as a CSV file, each with its account, Account Group and currency. Optionally filter by date range.',
      from: 'From',
      to: 'To',
      download: 'Download CSV',
    },
    rates: {
      title: 'Export Exchange Rates',
      description:
        'Download every stored exchange rate (pesos per dollar, by date) as a CSV file. These are the rates behind every converted total.',
      download: 'Download rates CSV',
    },
    backup: {
      title: 'Full Backup',
      description:
        'Download a complete JSON backup of all your data — accounts, transactions, budgets, categories, payees, rules, recurring transactions, goals, reports and dashboards. Bank connection credentials are not included.',
      download: 'Download Backup',
    },
    restore: {
      title: 'Restore from Backup',
      description:
        'Replace all of your data with a backup file. A copy of your current data is saved first.',
      file: 'Backup file',
      choose: 'Restore Backup…',
      restoring: 'Restoring…',
      notBackup: '{{name}} is not a FlyBudget backup file.',
      /** `total` is the number of transactions, with thousands separators */
      done: 'Restored {{name}} ({{total}} transactions).',
      doneWithCopy:
        'Restored {{name}} ({{total}} transactions). Your previous data was saved as {{file}} next to the database.',
      failed: 'Restore failed',
      confirmTitle: 'Restore this backup?',
      confirmMessage:
        'All of your current data will be replaced with the contents of {{name}}. Bank connections stay connected.',
      theBackup: 'the backup',
      confirm: 'Replace my data',
    },
  },
  preferences: {
    title: 'Preferences',
    saved: 'Settings are saved automatically to your browser.',
    savedInDemo: 'Settings are kept in this tab while you try the demo.',
    reset: 'Reset to defaults',
    resetTitle: 'Reset preferences',
    resetMessage: 'Are you sure you want to reset all preferences to their default values?',
    resetConfirm: 'Reset',
    theme: {
      title: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    } satisfies Record<Theme | 'title', string>,
    sidebar: {
      title: 'Sidebar',
      persistent: { label: 'Pinned', description: 'Always open' },
      'auto-hide': { label: 'Auto-hide', description: 'Collapsed, opens on hover' },
    } satisfies Record<SidebarMode, object> & { title: string },
    icons: {
      title: 'Icons',
      merchant: {
        label: 'Merchant',
        description: 'Merchant logos (or colored initials) next to merchant names',
      },
      category: { label: 'Category', description: 'Emoji icons next to category names' },
      account: {
        label: 'Account',
        description: 'Account logos (or colored initials) next to account names',
      },
      show: 'Show',
      hide: 'Hide',
    },
  },
  rates: {
    title: 'Exchange rates',
    description:
      'Pesos per dollar: the interbank rate, one per day. Weekends and holidays use the rate of the business day before.',
    loadError: "Couldn't load the exchange rates.",
    today: "Today's rate",
    /** After the rate: "$ 40.35 per US$ 1" */
    perDollar: 'per US$ 1',
    latest: 'The rate of {{day}}, the latest there is',
    noRate: 'No rate yet',
    lastFetched: 'Last fetched {{when}}.',
    neverFetched: 'Never fetched.',
    fetchPolicy: 'FlyBudget fetches new rates about once a day, when it starts.',
    fetchPolicyDemo:
      'The demo never fetches rates; in the app, FlyBudget fetches them about once a day.',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    enter: 'Enter a rate',
    byMonth: 'Rates by month',
    emptyTitle: 'No exchange rates yet',
    empty:
      'Rates for converting between pesos and dollars go here. Refresh to fetch them, or enter one by hand.',
    emptyDemo:
      'Rates for converting between pesos and dollars go here. Enter one by hand to try it.',
    monthRates: 'Rates of {{month}}',
    rateCount_one: '{{count}} rate',
    rateCount_other: '{{count}} rates',
    manual: 'Entered by hand',
    editDay: 'Edit the rate of {{day}}',
    correctTitle: 'Correct a rate',
    date: 'Date',
    pesosPerDollar: 'Pesos per dollar',
    replaces: 'Replaces {{rate}}. A rate entered by hand is kept when rates are fetched.',
    keptByHand: 'A rate entered by hand is kept when rates are fetched.',
    save: 'Save rate',
  },
  banks: {
    title: 'Connected Banks',
    description: 'Automatically import transactions from your financial institutions.',
    plaidSynced_one: 'Plaid sync complete: {{count}} new transaction imported.',
    plaidSynced_other: 'Plaid sync complete: {{count}} new transactions imported.',
    simplefinSynced_one: 'SimpleFIN sync complete: {{count}} new transaction imported.',
    simplefinSynced_other: 'SimpleFIN sync complete: {{count}} new transactions imported.',
    addAnotherBank: 'Add Another Bank',
    addAnotherConnection: 'Add Another Connection',
    syncing: 'Syncing...',
    syncAll: 'Sync All',
    syncNow: 'Sync Now',
    noPlaidBanks: 'No banks connected via Plaid yet.',
    connectBank: 'Connect Bank',
    plaidConfig: 'Plaid Configuration',
    plaidConfigHint: 'Enter your Plaid API credentials to enable bank connections.',
    simplefinConfig: 'SimpleFIN Configuration',
    simplefinConfigHint: 'Enter your SimpleFIN setup token to enable bank connections.',
    lastSynced: 'Last synced {{when}}',
    notLinked: 'Not linked',
    reconnect: 'Reconnect',
    disconnect: 'Disconnect',
    done: 'Done',
    syncResult: 'Synced: {{added}} added, {{modified}} modified, {{removed}} removed.',
    /** A connection's state, keyed by its sync status */
    syncStatus: {
      good: 'Synced',
      syncing: 'Syncing...',
      error: 'Error',
      login_required: 'Login Required',
    } satisfies Record<PlaidSyncStatus, string>,
    hostedLink: {
      title: 'Finish connecting in your browser',
      detail:
        'Plaid opened in your web browser. Log in to your bank there — FlyBudget will continue automatically when you’re done.',
      secure: 'Your bank login happens on Plaid’s secure site, never in FlyBudget.',
      reopen: 'Open Plaid again',
      cancelled: 'Connection cancelled.',
      expired: 'The Plaid session expired. Please try again.',
    },
    connect: {
      title: 'Connect Bank Account',
      heading: 'Connect Your Financial Institution',
      intro:
        'Securely link your bank accounts to automatically import transactions and keep your balances up to date.',
      preparing: 'Preparing...',
      syncingTitle: 'Syncing Transactions',
      syncingDetail: 'Importing your transactions. This may take a moment...',
      doneTitle: 'Connection Complete',
      /** `accounts` is `accountCount` */
      imported_one: 'Imported {{count}} transaction across {{accounts}}.',
      imported_other: 'Imported {{count}} transactions across {{accounts}}.',
      accountCount_one: '{{count}} account',
      accountCount_other: '{{count}} accounts',
    },
    /** Choosing what each account the bank has becomes */
    mapping: {
      intro: 'Choose how to set up each discovered account.',
      create: 'Create New',
      link: 'Link Existing',
      skip: 'Skip',
      linkTo: 'Account to link {{name}} to',
      selectAccount: 'Select an account...',
      accountName: 'Account name',
      saveAndSync: 'Save & Sync',
    },
    plaid: {
      setupTitle: 'Set Up Bank Sync',
      setupDetail:
        'Connect your bank accounts to automatically import transactions using Plaid. A developer account is free and always includes up to 10 bank connections.',
      getCredentials: 'Get Plaid credentials',
      clientId: 'Client ID',
      clientIdPlaceholder: 'Enter your Plaid Client ID',
      secret: 'Secret',
      secretPlaceholder: 'Enter your Plaid Secret',
      environment: 'Environment',
      production: 'Production — your real bank accounts',
      sandbox: 'Sandbox — test data only (for developers)',
      environmentHint: 'Use the secret that matches this environment in your Plaid dashboard.',
      save: 'Save Credentials',
      saveError: 'Failed to save credentials. Please check your input and try again.',
      modalTitle: 'Connect via Plaid',
      modalHeading: 'Connect with Plaid',
      /** `<signup>` links to Plaid's sign-up page */
      modalIntro:
        'Create a free <signup>Plaid developer account</signup> to get your API credentials, then enter them below.',
      configuredTitle: 'Plaid Configured',
      configuredDetail: 'Your credentials have been saved. You can now connect your bank.',
      loginRequired:
        'Your bank requires you to re-authenticate. Click "Reconnect" to update your credentials.',
      disconnectTitle: 'Disconnect Institution',
      disconnectMessage:
        "Are you sure you want to disconnect {{name}}? This revokes FlyBudget's access to this bank at Plaid. Your existing accounts and transactions will not be deleted.",
    },
    simplefin: {
      setupDetail:
        'Connect your bank accounts to automatically import transactions using SimpleFIN Bridge. The service costs $1.50/month paid directly to SimpleFIN.',
      getToken: 'Get a SimpleFIN token',
      token: 'Setup Token',
      tokenPlaceholder: 'Paste your SimpleFIN setup token',
      connect: 'Connect',
      connecting: 'Connecting...',
      connectError: 'Failed to connect. Check your setup token and try again.',
      modalTitle: 'Connect via SimpleFIN',
      modalHeading: 'Connect with SimpleFIN Bridge',
      /** `<bridge>` links to SimpleFIN Bridge */
      modalIntro:
        'Visit <bridge>SimpleFIN Bridge</bridge> to create a setup token, then paste it below. SimpleFIN costs $1.50/month paid directly to them.',
      synced_one: 'Synced: {{count}} new transaction imported.',
      synced_other: 'Synced: {{count}} new transactions imported.',
      disconnectTitle: 'Disconnect SimpleFIN',
      disconnectMessage:
        'Are you sure you want to disconnect {{name}}? FlyBudget will delete its stored access. To revoke it completely, also remove this app from your SimpleFIN Bridge account at bridge.simplefin.org. Your existing accounts and transactions will not be deleted.',
    },
  },
  server: {
    version: 'Version {{version}}',
    versionSentence: 'Version {{version}}.',
    local: {
      title: 'Where your data lives',
      demoTitle: 'In this browser (demo)',
      demoDetail:
        'This demo runs entirely in your browser: nothing you change is sent anywhere or saved. In the app, your budget is a file on your computer or on a server you run.',
      computerTitle: 'On this computer',
      computerDetail:
        'Your budget is a file on this computer, and FlyBudget only talks to it through its own local server. Nothing is sent to FlyBudget or anyone else; bank sync contacts Plaid or SimpleFIN only when you connect a bank.',
      otherDevicesTitle: 'Use FlyBudget on your phone and other devices',
      otherDevicesDetail:
        'Run FlyBudget on a server you control, such as a home server or a small cloud machine, and sign in from any browser. Your data moves to that server; nobody else hosts it.',
      guide: 'Read the self-hosting guide',
      backupFirst: 'Make a backup first',
    },
    offline: {
      title: 'Offline copy',
      keep: 'Keep a copy of my budget on this device',
      detail:
        "When FlyBudget can't reach its server, it opens with what this browser last loaded. You can look through everything and add new transactions; they're sent when it reconnects. The copy is deleted when you sign out. Turn this off on a shared computer.",
      waiting_one: '{{count}} transaction saved on this device is waiting to be sent.',
      waiting_other: '{{count}} transactions saved on this device are waiting to be sent.',
    },
    /** The security check of a self-hosted server; `<env>` marks an env var name */
    checks: {
      title: 'Security check',
      checking: 'Checking your server…',
      allGood: 'Everything looks good for how you connected just now.',
      warnings_one:
        '{{count}} thing to look at. Each is fixed with a setting in your docker-compose.yml.',
      warnings_other:
        '{{count}} things to look at. Each is fixed with a setting in your docker-compose.yml.',
      passed: 'Passed',
      warning: 'Warning',
      httpsSecure: 'Connection is encrypted (HTTPS)',
      httpsLocal: 'Connected on the same computer as the server',
      httpsOff: 'Not using HTTPS: passwords and data travel unencrypted',
      httpsFix:
        'Put FlyBudget behind a reverse proxy with HTTPS (Caddy, Nginx, Traefik) or a VPN, and set <env>FLYBUDGET_TRUST_PROXY</env>.',
      proxyOk: 'Reverse proxy settings match how you connect',
      proxyUntrusted: 'A reverse proxy is in front of FlyBudget, but not trusted',
      proxyUntrustedFix:
        'Set <env>FLYBUDGET_TRUST_PROXY=1</env> (the number of proxies in front of FlyBudget) so HTTPS and client addresses are detected.',
      proxyUnused: 'FLYBUDGET_TRUST_PROXY is set, but this request came without a proxy',
      proxyUnusedFix:
        'If you connect directly, remove <env>FLYBUDGET_TRUST_PROXY</env>: otherwise clients can fake their address and get around the login attempt limit.',
      hostsOk: 'Only answers to the addresses you allowed',
      hostsAny: 'Answers to any host name',
      hostsFix:
        'Set <env>FLYBUDGET_ALLOWED_HOSTS</env> to the address you use, e.g. <env>FLYBUDGET_ALLOWED_HOSTS=budget.example.com</env>.',
      keyOk: 'Bank credentials are encrypted at rest',
      keyMissing: 'Bank credentials are not encrypted',
      keyFix:
        'Set <env>FLYBUDGET_DATA_KEY_FILE</env> to a file with a random key (see the self-hosting guide).',
      passwordOk: 'A password protects this server',
      passwordMissing: 'No password is set yet',
    },
    devices: {
      title: 'Signed-in devices',
      description:
        "Browsers signed in to this server. Sign out any you don't recognize, then change the password.",
      loadError: "Couldn't load the devices.",
      thisDevice: 'This device',
      /** "Chrome on Mac": the names of browsers and systems are not translated */
      browserOn: '{{browser}} on {{os}}',
      unknown: 'Unknown browser',
      /** `active` and `signedIn` are "5 minutes ago" */
      activeAndSignedIn: 'Active {{active}} · signed in {{signedIn}}',
      signedIn: 'Signed in {{signedIn}}',
      signOutNamed: 'Sign out {{name}}',
      signOutOthers: 'Sign out all other devices',
    },
    password: {
      title: 'Change password',
      description:
        'This password protects your FlyBudget server. Changing it signs out every other device.',
      current: 'Current password',
      new: 'New password',
      confirm: 'Confirm new password',
      mismatch: "The new passwords don't match.",
      changed: 'Password changed. Other devices have been signed out.',
    },
    signOut: {
      button: 'Sign out',
      description: 'Sign out of FlyBudget on this browser.',
    },
  },
  /** The server's refusals, by code (api/serverErrors.ts): the English is the server's own */
  errors: {
    bankRateLimit: 'Too many bank requests. Wait a minute and try again.',
    ratesRefreshLimit: 'Exchange rates were refreshed a lot just now. Try again in an hour.',
    notABackup: 'This is not a FlyBudget backup file',
    backupNewerVersion: 'This backup was made by a newer version of FlyBudget',
    backupInconsistent: 'The backup is inconsistent, so nothing was restored',
    backupRowInvalid: 'Row {{row}} of "{{table}}" is not valid',
    simplefinInvalidToken: 'Invalid setup token',
    simplefinTokenUsed:
      'This setup token was already used or revoked — create a new one in SimpleFIN Bridge',
    simplefinInvalidUrl: 'Invalid SimpleFIN access URL',
    simplefinSubscriptionRequired:
      'SimpleFIN subscription required — visit simplefin.org to activate',
    simplefinAccessDenied: 'SimpleFIN access denied — the connection may have been revoked',
    simplefinBadResponse: 'SimpleFIN returned an invalid response',
    simplefinUnreachable: 'Could not reach SimpleFIN. Try again later.',
    bankAddressRefused: 'Refusing to connect to a non-public address',
    plaidNotConfigured: 'Plaid is not configured',
    plaidLinkFailed: 'Could not finish connecting to Plaid',
    plaidRevokeFailed:
      'Could not revoke access at Plaid, so the connection was kept. Check your internet connection and try again.',
    syncFailed: 'Sync failed',
    ratesRefreshFailed: "Couldn't get exchange rates right now. The rates already stored are kept.",
    ratesFetchingOff: 'Fetching exchange rates is switched off (FLYBUDGET_EXCHANGE_RATES=off)',
    rateDateInFuture: 'Choose a date up to today',
    pickAnotherCategory: 'Pick another category',
  },
} as const;
