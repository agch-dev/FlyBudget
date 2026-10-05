import { usePreferencesStore } from '../store/preferencesStore';
import { moneyIn, type Money } from '../utils/currency';
import type { Currency } from '../types';

/**
 * The Viewing Currency (GLOSSARY.md): what combined totals are shown in on the dashboard,
 * reports, cash flow and net worth. Chosen with `ViewingCurrencySwitch`, remembered on this
 * device, pesos until changed. The Budget, planned amounts and Goals never use it (pesos), and
 * neither does anything that belongs to one account (its own currency).
 */
export const useViewingCurrency = (): Currency => usePreferencesStore((s) => s.viewingCurrency);

/** The viewing currency with its formatters: `format(cents)` and `axis(cents)` carry its sign */
export const useViewingMoney = (): Money => moneyIn(useViewingCurrency());
