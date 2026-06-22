import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../lib/queryKeys';
import { getPortfolioList, PortfolioFilters } from '../api/portfolio.api';

export function usePortfolioList(filters: PortfolioFilters = {}) {
  return useQuery({
    queryKey: queryKeys.portfolio.list(filters),
    queryFn: () => getPortfolioList(filters),
    staleTime: 30_000,
  });
}
