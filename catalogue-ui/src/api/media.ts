import { apiGet, apiPut } from '@/lib/api';
import type { MediaPaths, UpdateMediaPathsRequest } from '@/types';

export function getMediaPaths(): Promise<MediaPaths> {
  return apiGet<MediaPaths>('/api/media/paths');
}

export function updateMediaPaths(
  body: UpdateMediaPathsRequest,
): Promise<MediaPaths> {
  return apiPut<MediaPaths>('/api/media/paths', body);
}
