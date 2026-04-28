import { apiFetch } from './client';
import type { CategoryGroup } from '../types';

export const getCategories = () => apiFetch<CategoryGroup[]>('/categories');
