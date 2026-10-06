import { refusal } from '../utils/refusals.js';

// Refusals more than one transaction write answers with, defined once. Pure, so the linking
// rules (transferLink.ts) can return them too.

/** Editing, deleting, linking or unlinking a reconciled transaction (answered with 403) */
export const RECONCILED = refusal(
  'transaction_reconciled',
  'Cannot modify a reconciled transaction',
);
