import type { Currency } from '../../types';

// Goals: savings targets, their progress and the form.
export default {
  page: {
    title: 'Goals',
    add: 'Add Goal',
    emptyTitle: 'Save for what matters',
    emptyDescription:
      'Set a target like an emergency fund, a trip or a new car, and see how close you are and how much to set aside each month.',
    inProgress: 'In progress',
    completed: 'Completed',
    deleteTitle: 'Delete Goal',
    deleteMessage: 'Delete "{{name}}"? This cannot be undone.',
    delete: 'Delete',
  },
  summary: {
    saved: 'Saved',
    percentOfTarget: '{{percent}}% of target',
    target: 'Target',
    leftToSave: 'Left to save',
    reached: 'Goals reached',
    reachedOf: '{{reached}} of {{total}}',
    converted: "Totals are in pesos, with dollar goals converted at today's exchange rate.",
    notCounted_one:
      '{{count}} dollar goal is not in these totals because there is no exchange rate yet. <rates>Enter rates</rates>',
    notCounted_other:
      '{{count}} dollar goals are not in these totals because there is no exchange rate yet. <rates>Enter rates</rates>',
  },
  group: {
    count_one: '{{count}} goal',
    count_other: '{{count}} goals',
  },
  card: {
    /** A date as a date-fns pattern */
    dateFormat: 'MMM d, yyyy',
    target: 'Target {{date}}',
    ofTarget: 'of {{amount}}',
    edit: 'Edit goal',
    delete: 'Delete goal',
    reached: 'Goal reached',
    overdue: 'Past target date · {{amount}} to go',
    toGo: '{{amount}} to go',
    toGoPerMonth: '{{amount}} to go<small> · {{perMonth}}/mo to reach it on time</small>',
  },
  form: {
    addTitle: 'Add Goal',
    editTitle: 'Edit Goal',
    name: 'Name',
    namePlaceholder: 'e.g. Emergency Fund',
    target: 'Target',
    saved: 'Saved so far',
    targetDate: 'Target date (optional)',
    targetDateLabel: 'Target date',
    account: 'Linked account (optional)',
    accountLabel: 'Linked account',
    noAccount: 'None',
    currencyLocked: "A goal is in its linked account's currency.",
    icon: 'Icon',
    color: 'Color',
    colorOption: 'Color {{color}}',
    cancel: 'Cancel',
    save: 'Save',
    add: 'Add Goal',
  },
  /** Saving a goal whose linked account puts it in the other currency */
  checkTarget: {
    title: 'Check the target',
    /** Keyed by the currency of the linked account */
    account: {
      UYU: '{{account}} is in pesos, so this goal changes from dollars to pesos. Its amounts keep their numbers and are not converted.',
      USD: '{{account}} is in dollars, so this goal changes from pesos to dollars. Its amounts keep their numbers and are not converted.',
    } satisfies Record<Currency, string>,
    /** Stands in for the account's name when it is not known */
    linkedAccount: 'The linked account',
    question: 'Is that the right target?',
    change: 'Change amounts',
    save: 'Yes, save',
  },
} as const;
