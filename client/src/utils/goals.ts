import { HOME_CURRENCY, type Currency, type GoalInPesos } from '../types';

// Goal figures. A goal's own numbers (progress, what is left, the monthly amount) are in the
// goal's currency. The page's summary adds goals up in pesos, using the amounts the server
// converted at today's rate (`inPesos`); nothing here knows a rate.

interface Amounts {
  targetAmount: number;
  currentAmount: number;
}

/** How far a goal is, in its own currency. */
export function progressOf(goal: Amounts) {
  const pct =
    goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  return { pct, remaining: Math.max(0, goal.targetAmount - goal.currentAmount) };
}

interface Summable extends Amounts {
  currency?: Currency;
  inPesos?: GoalInPesos | null;
}

/**
 * A goal's amounts in pesos: what the server converted, or its own amounts for a pesos goal
 * that came without them (a goal just saved, or one from an older offline copy). Null for a
 * dollar goal with no exchange rate to convert it.
 */
export function goalInPesos(goal: Summable): GoalInPesos | null {
  if (goal.inPesos) return goal.inPesos;
  if ((goal.currency ?? HOME_CURRENCY) !== HOME_CURRENCY) return null;
  return {
    target: goal.targetAmount,
    saved: goal.currentAmount,
    remaining: progressOf(goal).remaining,
  };
}

export interface GoalsSummary {
  saved: number;
  target: number;
  leftToSave: number;
  /** Saved as a whole percentage of the target */
  percent: number;
  /** Dollar goals left out because they could not be converted */
  notCounted: number;
}

/** The Goals page's summary cards: every goal in pesos at today's rate. */
export function goalsSummary(goals: readonly Summable[]): GoalsSummary {
  const summary = { saved: 0, target: 0, leftToSave: 0, percent: 0, notCounted: 0 };
  for (const goal of goals) {
    const pesos = goalInPesos(goal);
    if (!pesos) {
      summary.notCounted += 1;
      continue;
    }
    summary.saved += pesos.saved;
    summary.target += pesos.target;
    summary.leftToSave += pesos.remaining;
  }
  if (summary.target > 0) {
    summary.percent = Math.max(0, Math.floor((summary.saved / summary.target) * 100));
  }
  return summary;
}

/**
 * The currency of the goal being edited in the form. A linked account sets it and locks the
 * choice; with no account it is the one the user picked.
 */
export function formCurrency(
  accountId: string,
  accounts: readonly { id: string; currency: Currency }[],
  chosen: Currency,
): { currency: Currency; locked: boolean } {
  if (!accountId) return { currency: chosen, locked: false };
  const account = accounts.find((a) => a.id === accountId);
  return { currency: account?.currency ?? chosen, locked: true };
}

/**
 * Whether saving should first ask the user to confirm the target: an existing goal whose
 * linked account puts it in the other currency, so the same number now means something else.
 * Picking the currency by hand needs no question.
 */
export function targetNeedsConfirming(
  editGoal: { currency?: Currency; accountId: string | null } | null | undefined,
  form: { accountId: string; currency: Currency },
): boolean {
  if (!editGoal || !form.accountId) return false;
  return (editGoal.currency ?? HOME_CURRENCY) !== form.currency;
}
