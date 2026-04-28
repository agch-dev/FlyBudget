import { apiFetch } from './client';
import type { Payee } from '../types';

export const getPayees = () => apiFetch<Payee[]>('/payees');
