// Accounts, the reconciliation flow and the first-run screen (/welcome).
export default {
  welcome: {
    title: 'Welcome to <brand></brand>!',
    intro:
      'A budget that shows where your money goes and gives every dollar a job. Start by adding the accounts you want to track.',
    setupTime: 'Setup time:',
    plaid: {
      title: 'Connect with Plaid',
      tag: 'Free',
      time: '~10 min + approval',
      description:
        'Set it up once and new transactions arrive on their own. Create a free Plaid developer account; Plaid then approves access to your real banks.',
      action: 'Connect Plaid',
    },
    simplefin: {
      title: 'Connect with SimpleFIN',
      tag: '$1.50/month',
      time: '~5 min',
      description:
        'Set it up once and new transactions arrive on their own, through SimpleFIN Bridge (thousands of banks). Paid directly to SimpleFIN.',
      action: 'Connect SimpleFIN',
    },
    manual: {
      title: 'Add accounts manually',
      tag: 'No bank link',
      time: '~1 min each',
      description:
        'You add each account and its balance yourself. Transactions are manual too: download CSV files from your bank and import them yourself, or enter each one by hand. Nothing updates on its own.',
      action: 'Add manually',
    },
    storedOnServer: 'Your budget is stored on your own server. No FlyBudget account, no tracking.',
    storedHere: 'Your budget stays on this computer. No FlyBudget account, no tracking.',
    compareBanks: 'Compare bank options',
    skip: 'Skip for now and look around',
  },
} as const;
