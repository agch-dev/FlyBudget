import { apiFetch } from './client';
import type { Currency } from '../types';

/** One side of a transfer suggestion; `amount` is the native amount, in `currency` */
export interface TransferSuggestionSide {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  currency: Currency;
  payeeName: string | null;
}

/** Two unlinked transactions that look like the two sides of a transfer */
export interface TransferSuggestion {
  /** The money leaving one account */
  outflow: TransferSuggestionSide;
  /** The money arriving in the other */
  inflow: TransferSuggestionSide;
  /** Pesos per dollar the two amounts imply; null within one currency */
  rate: number | null;
}

/** Newest first; each transaction is in at most one. Confirm one with `linkTransfer` */
export const getTransferSuggestions = () => apiFetch<TransferSuggestion[]>('/transfer-suggestions');

/** This pair is not a transfer: it is not suggested again */
export const dismissTransferSuggestion = (transactionId: string, otherTransactionId: string) =>
  apiFetch<void>('/transfer-suggestions/dismiss', {
    method: 'POST',
    body: JSON.stringify({ transactionId, otherTransactionId }),
  });
