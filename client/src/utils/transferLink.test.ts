import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canLinkAsTransfer, filterTransferCandidates } from './transferLink';
import type { Transaction } from '../types';

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 't',
    accountId: 'a',
    date: '2025-03-10',
    amount: -1000,
    payeeName: null,
    notes: null,
    reconciled: 0,
    isParent: 0,
    parentTransactionId: null,
    transferTransactionId: null,
    ...over,
  }) as Transaction;

describe('canLinkAsTransfer', () => {
  it('is true for an ordinary outflow or inflow', () => {
    expect(canLinkAsTransfer(tx({ amount: -1000 }))).toBe(true);
    expect(canLinkAsTransfer(tx({ amount: 1000 }))).toBe(true);
  });

  it('is false for reconciled, split, already linked and zero transactions', () => {
    expect(canLinkAsTransfer(tx({ reconciled: 1 }))).toBe(false);
    expect(canLinkAsTransfer(tx({ isParent: 1 }))).toBe(false);
    expect(canLinkAsTransfer(tx({ parentTransactionId: 'p' }))).toBe(false);
    expect(canLinkAsTransfer(tx({ transferTransactionId: 'o' }))).toBe(false);
    expect(canLinkAsTransfer(tx({ amount: 0 }))).toBe(false);
  });
});

describe('filterTransferCandidates', () => {
  const list = [
    tx({ id: '1', accountId: 'brou', payeeName: 'TRASPASO DE 123' }),
    tx({ id: '2', accountId: 'itau', payeeName: 'Sueldo', notes: 'marzo' }),
    tx({ id: '3', accountId: 'itau', payeeName: null }),
  ];
  const accountName = (id: string) => ({ brou: 'BROU pesos', itau: 'Itaú dólares' })[id] ?? '';

  it('finds text in the payee, the notes or the account name, ignoring case', () => {
    const ids = (q: string) => filterTransferCandidates(list, q, accountName).map((t) => t.id);
    expect(ids('traspaso')).toEqual(['1']);
    expect(ids('MARZO')).toEqual(['2']);
    expect(ids('itaú')).toEqual(['2', '3']);
    expect(ids('nothing like it')).toEqual([]);
  });

  it('keeps everything, in order, when the filter is blank', () => {
    expect(filterTransferCandidates(list, '  ', accountName)).toEqual(list);
  });

  it('only ever removes rows, never reorders them', () => {
    fc.assert(
      fc.property(fc.string(), (q) => {
        const ids = filterTransferCandidates(list, q, accountName).map((t) => Number(t.id));
        expect(ids).toEqual([...ids].sort((a, b) => a - b));
      }),
    );
  });
});
