import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMediaPaths, updateMediaPaths } from '@/api/media';
import type { UpdateMediaPathsRequest } from '@/types';

export function useMediaPaths(enabled: boolean) {
  return useQuery({
    queryKey: ['media', 'paths'],
    queryFn: getMediaPaths,
    enabled,
  });
}

export function useUpdateMediaPaths() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateMediaPathsRequest) => updateMediaPaths(body),
    onSuccess: async (data) => {
      queryClient.setQueryData(['media', 'paths'], data);
      await queryClient.invalidateQueries();
    },
  });
}
