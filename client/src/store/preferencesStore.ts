import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { IS_DEMO } from '../demo/isDemo';
import type { ImportConventions } from '../utils/csv';

export type Theme = 'light' | 'dark' | 'system';
export type DateFormatOption = 'MMM d, yyyy' | 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';
export type SidebarMode = 'persistent' | 'auto-hide';

interface PreferencesState {
  theme: Theme;
  dateFormat: DateFormatOption;
  savingsGoal: number;
  sidebarMode: SidebarMode;
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
  /** CSV import choices (date order, decimal mark) last used for each account, by account id */
  csvImportConventions: Record<string, ImportConventions>;
  setTheme: (theme: Theme) => void;
  setDateFormat: (format: DateFormatOption) => void;
  setSavingsGoal: (goal: number) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setShowMerchantIcons: (show: boolean) => void;
  setShowCategoryIcons: (show: boolean) => void;
  setShowAccountIcons: (show: boolean) => void;
  setUpcomingLength: (length: string) => void;
  setKeepOfflineCopy: (keep: boolean) => void;
  setSetupSkipped: (skipped: boolean) => void;
  setGettingStartedHidden: (hidden: boolean) => void;
  setCsvImportConventions: (accountId: string, conventions: ImportConventions) => void;
}

const PREFERENCES_KEY = 'budget-preferences';

/**
 * Brings preferences saved by an earlier version up to date. Version 1 removed the currency
 * symbol: each account now has its own currency (pesos `$` or dollars `US$`).
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
      dateFormat: 'MMM d, yyyy',
      savingsGoal: 20,
      sidebarMode: 'persistent',
      showMerchantIcons: true,
      showCategoryIcons: true,
      showAccountIcons: true,
      upcomingLength: '7',
      keepOfflineCopy: true,
      setupSkipped: false,
      gettingStartedHidden: false,
      csvImportConventions: {},
      setTheme: (theme) => set({ theme }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setSavingsGoal: (savingsGoal) => set({ savingsGoal }),
      setSidebarMode: (sidebarMode) => set({ sidebarMode }),
      setShowMerchantIcons: (showMerchantIcons) => set({ showMerchantIcons }),
      setShowCategoryIcons: (showCategoryIcons) => set({ showCategoryIcons }),
      setShowAccountIcons: (showAccountIcons) => set({ showAccountIcons }),
      setUpcomingLength: (upcomingLength) => set({ upcomingLength }),
      setKeepOfflineCopy: (keepOfflineCopy) => set({ keepOfflineCopy }),
      setSetupSkipped: (setupSkipped) => set({ setupSkipped }),
      setGettingStartedHidden: (gettingStartedHidden) => set({ gettingStartedHidden }),
      setCsvImportConventions: (accountId, conventions) =>
        set((state) => ({
          csvImportConventions: { ...state.csvImportConventions, [accountId]: conventions },
        })),
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
