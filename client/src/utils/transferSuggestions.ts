import type { TransferSuggestion } from '../api/transferSuggestions';

/** The suggestions with a side in this account's register; all of them without an account */
export function suggestionsForAccount(
  suggestions: TransferSuggestion[],
  accountId?: string,
): TransferSuggestion[] {
  if (!accountId) return suggestions;
  return suggestions.filter(
    (s) => s.outflow.accountId === accountId || s.inflow.accountId === accountId,
  );
}

/** "1 possible transfer" / "3 possible transfers" */
export function suggestionCountLabel(count: number): string {
  return `${count} possible transfer${count === 1 ? '' : 's'}`;
}
