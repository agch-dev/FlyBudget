import { describe, expect, it } from 'vitest';
import { defaultDestination, destinationAccounts, isCardType } from './importDestination';
import type { Currency } from '../types';

const account = (
  id: string,
  type: string,
  currency: Currency,
  groupName: string | null = null,
  closedAt: string | null = null,
) => ({ id, type, currency, groupName, closedAt });

describe('where the other currency of a card statement goes', () => {
  const card = account('card-uyu', 'credit', 'UYU', 'Santander');
  const cardDollars = account('card-usd', 'credit', 'USD', 'santander');
  // A group can be a whole bank: its dollar savings account is not the card's other side
  const savingsDollars = account('savings-usd', 'savings', 'USD', 'Santander');
  const otherBank = account('itau-usd', 'credit', 'USD', 'Itaú');
  const closed = account('old-usd', 'credit', 'USD', 'Santander', '2026-01-01');
  const all = [
    card,
    cardDollars,
    savingsDollars,
    otherBank,
    closed,
    account('cash', 'cash', 'UYU'),
  ];

  it('offers every open account of that currency, never the account itself', () => {
    expect(destinationAccounts(card, all, 'USD').map((a) => a.id)).toEqual([
      'card-usd',
      'savings-usd',
      'itau-usd',
    ]);
    expect(destinationAccounts(cardDollars, all, 'UYU').map((a) => a.id)).toEqual([
      'card-uyu',
      'cash',
    ]);
  });

  it('picks the only account of the same type in the same group', () => {
    expect(defaultDestination(card, all, 'USD')).toBe('card-usd');
    expect(defaultDestination(cardDollars, all, 'UYU')).toBe('card-uyu');
  });

  it('picks nothing when the choice is not obvious', () => {
    const second = account('card-usd-2', 'credit', 'USD', 'Santander');
    expect(defaultDestination(card, [...all, second], 'USD')).toBeNull();
    expect(defaultDestination(card, [card, savingsDollars, otherBank], 'USD')).toBeNull();
    // No group: any dollar card could be the one
    expect(defaultDestination(account('solo', 'credit', 'UYU'), all, 'USD')).toBeNull();
  });

  it('knows which accounts are cards', () => {
    expect(isCardType('credit')).toBe(true);
    expect(isCardType('line_of_credit')).toBe(true);
    expect(isCardType('savings')).toBe(false);
  });
});
