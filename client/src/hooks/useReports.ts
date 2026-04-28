import { useQuery } from '@tanstack/react-query';
import * as reportsApi from '../api/reports';

export const useNetWorth = (from: string, to: string) =>
  useQuery({ queryKey: ['reports', 'net-worth', from, to], queryFn: () => reportsApi.getNetWorth(from, to) });

export const useIncomeVsExpenses = (from: string, to: string) =>
  useQuery({ queryKey: ['reports', 'income-expenses', from, to], queryFn: () => reportsApi.getIncomeVsExpenses(from, to) });

export const useCashFlow = (from: string, to: string) =>
  useQuery({ queryKey: ['reports', 'cash-flow', from, to], queryFn: () => reportsApi.getCashFlow(from, to) });

export const useSpendingByCategory = (from: string, to: string) =>
  useQuery({ queryKey: ['reports', 'spending-by-category', from, to], queryFn: () => reportsApi.getSpendingByCategory(from, to) });
