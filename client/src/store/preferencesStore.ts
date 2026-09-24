import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type DateFormatOption = 'MMM d, yyyy' | 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd';
export type SidebarMode = 'persistent' | 'auto-hide';

interface PreferencesState {
  theme: Theme;
  currencySymbol: string;
  dateFormat: DateFormatOption;
  savingsGoal: number;
  sidebarMode: SidebarMode;
  setTheme: (theme: Theme) => void;
  setCurrencySymbol: (symbol: string) => void;
  setDateFormat: (format: DateFormatOption) => void;
  setSavingsGoal: (goal: number) => void;
  setSidebarMode: (mode: SidebarMode) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'light',
      currencySymbol: '$',
      dateFormat: 'MMM d, yyyy',
      savingsGoal: 20,
      sidebarMode: 'persistent',
      setTheme: (theme) => set({ theme }),
      setCurrencySymbol: (currencySymbol) => set({ currencySymbol }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setSavingsGoal: (savingsGoal) => set({ savingsGoal }),
      setSidebarMode: (sidebarMode) => set({ sidebarMode }),
    }),
    { name: 'budget-preferences' },
  ),
);
