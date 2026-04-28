import { useQuery } from '@tanstack/react-query';
import { getPayees } from '../api/payees';

export function usePayees() {
  return useQuery({ queryKey: ['payees'], queryFn: getPayees });
}
