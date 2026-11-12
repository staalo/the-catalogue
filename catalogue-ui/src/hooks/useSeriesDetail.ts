import { useQuery } from '@tanstack/react-query';
import { getSeriesDetail } from '@/api/catalogue';

export function useSeriesDetail(seriesId: number | null, userName?: string) {
  return useQuery({
    queryKey: ['catalogue', 'series', userName, seriesId],
    queryFn: () => getSeriesDetail(seriesId as number),
    enabled: seriesId !== null && Boolean(userName),
  });
}
