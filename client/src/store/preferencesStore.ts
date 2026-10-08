import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { IS_DEMO } from '../demo/isDemo';
import type { ImportMemory } from '../utils/csv';
import { toggleGroupOpen } from '../utils/accountGroups';
import { HOME_CURRENCY, type Currency } from '../types';
import { SIDEBAR_DEFAULT_WIDTH, clampSidebarWidth } from '../utils/sidebarWidth';
import { browserLanguage, detectLanguage, type Language } from '../i18n/language';

export type Theme = 'light' | 'dark' | 'system';
export type DateFormatOption =
  'MMM d, yyyy' | 'd MMM yyyy' | 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';
export type SidebarMode = 'persistent' | 'auto-hide';

interface PreferencesState {
  theme: Theme;
  dateFormat: DateFormatOption;
  savingsGoal: number;
  sidebarMode: SidebarMode;
  /** The desktop sidebar's width in pixels, dragged by its edge (utils/sidebarWidth.ts) */
  sidebarWidth: number;
  showMerchantIcons: boolean;
  showCategoryIcons: boolean;
  showAccountIcons: boolean;
  /** Actual Budget-style upcoming window token: '1' | '7' | '14' | 'oneMonth' | 'currentMonth' | '<n>-<day|week|month|year>' */
  upcomingLength: string;
  /** Keep a copy of the budget on this device, to open it when the server can't be reached */
  keepOfflineCopy: boolean;
  /** "Skip for now" on the welcome screen: open the app even with no accounts */
  setupSkipped: boolean;
  /** The getting started checklist on the dashboard was hidden */
  gettingStartedHidden: boolean;
  /**
   * Import choices last used for each account, by account id, from before they were stored on
   * the server. Only read, for an account the server has none for (utils/importMemory.ts)
   */
  csvImportConventions: Record<string, ImportMemory>;
  /** Account Groups expanded in the sidebar on this device, by name; the rest are closed */
  openAccountGroups: string[];
  /**
   * The Viewing Currency (GLOSSARY.md): what combined totals are shown in on the dashboard,
   * reports, cash flow and net worth on this device. Never the Budget, which is in pesos.
   */
  viewingCurrency: Currency;
  /**
   * The App Language (GLOSSARY.md): the language of the app's own text on this device. A
   * device that never chose gets the browser's language. utils/applyLanguage.ts applies it.
   */
  language: Language;
  setTheme: (theme: Theme) => void;
  setDateFormat: (format: DateFormatOption) => void;
  setSavingsGoal: (goal: number) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setSidebarWidth: (width: number) => void;
  setShowMerchantIcons: (show: boolean) => void;
  setShowCategoryIcons: (show: boolean) => void;
  setShowAccountIcons: (show: boolean) => void;
  setUpcomingLength: (length: string) => void;
  setKeepOfflineCopy: (keep: boolean) => void;
  setSetupSkipped: (skipped: boolean) => void;
  setGettingStartedHidden: (hidden: boolean) => void;
  toggleAccountGroup: (name: string) => void;
  setViewingCurrency: (currency: Currency) => void;
  setLanguage: (language: Language) => void;
}

/**
 * The date format of a device that has never chosen one: day first ("5 oct 2026") when the
 * device starts in Spanish. Switching language later never changes the date format.
 */
export function defaultDateFormat(language: Language): DateFormatOption {
  return language === 'es' ? 'd MMM yyyy' : 'MMM d, yyyy';
}

/** What this device starts in, until the user chooses: the browser's language */
const startingLanguage = detectLanguage(browserLanguage());

const PREFERENCES_KEY = 'budget-preferences';

/**
 * Brings preferences saved by an earlier version up to date. Version 1 removed the currency
 * symbol: each account now has its own currency (pesos `$` or dollars `US$`). Preferences
 * saved before the App Language existed have no `language` and get the browser's.
 */
export function migratePreferences(saved: unknown): Partial<PreferencesState> {
  if (!saved || typeof saved !== 'object') return {};
  const { currencySymbol: _removed, ...rest } = saved as Record<string, unknown>;
  return rest as Partial<PreferencesState>;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      dateFormat: defaultDateFormat(startingLanguage),
      savingsGoal: 20,
      sidebarMode: 'persistent',
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      showMerchantIcons: true,
      showCategoryIcons: true,
      showAccountIcons: true,
      upcomingLength: '7',
      keepOfflineCopy: true,
      setupSkipped: false,
      gettingStartedHidden: false,
      csvImportConventions: {},
      openAccountGroups: [],
      viewingCurrency: HOME_CURRENCY,
      language: startingLanguage,
      setTheme: (theme) => set({ theme }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setSavingsGoal: (savingsGoal) => set({ savingsGoal }),
      setSidebarMode: (sidebarMode) => set({ sidebarMode }),
      setSidebarWidth: (width) => set({ sidebarWidth: clampSidebarWidth(width) }),
      setShowMerchantIcons: (showMerchantIcons) => set({ showMerchantIcons }),
      setShowCategoryIcons: (showCategoryIcons) => set({ showCategoryIcons }),
      setShowAccountIcons: (showAccountIcons) => set({ showAccountIcons }),
      setUpcomingLength: (upcomingLength) => set({ upcomingLength }),
      setKeepOfflineCopy: (keepOfflineCopy) => set({ keepOfflineCopy }),
      setSetupSkipped: (setupSkipped) => set({ setupSkipped }),
      setGettingStartedHidden: (gettingStartedHidden) => set({ gettingStartedHidden }),
      toggleAccountGroup: (name) =>
        set((state) => ({ openAccountGroups: toggleGroupOpen(state.openAccountGroups, name) })),
      setViewingCurrency: (viewingCurrency) => set({ viewingCurrency }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: PREFERENCES_KEY,
      version: 1,
      migrate: migratePreferences,
      // The demo (website "Try the demo") shares the website's storage: keep its preferences
      // in this tab only, so they're gone with the demo budget when the tab closes
      storage: createJSONStorage(() => (IS_DEMO ? sessionStorage : localStorage)),
    },
  ),
);

/** Back to the defaults (the demo's "Start over"). */
export function resetPreferences() {
  usePreferencesStore.setState(usePreferencesStore.getInitialState(), true);
}
