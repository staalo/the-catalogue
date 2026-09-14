import { apiGet, apiPut } from '@/lib/api';

export type MoviePlaybackProgress = {
  movieId: number;
  progress: number;
  updatedAt: string;
};

type MoviePlaybackProgressResult = {
  items: MoviePlaybackProgress[];
};

export async function getMoviePlaybackProgress(): Promise<MoviePlaybackProgress[]> {
  const result = await apiGet<MoviePlaybackProgressResult>('/api/playback/movies');
  return result.items;
}

export function updateMoviePlaybackProgress(
  movieId: number,
  progress: number,
): Promise<MoviePlaybackProgress> {
  return apiPut<MoviePlaybackProgress>(`/api/playback/movies/${movieId}`, {
    progress,
  });
}
