import { expect, test } from 'vitest';
import { genreRailsFor } from '@/lib/genreRails';
import type { Media } from '@/types';

function title(values: Pick<Media, 'id' | 'title' | 'type' | 'genres'>): Media {
  return {
    year: '1990',
    meta: '',
    image: '',
    backdrop: '',
    description: '',
    ...values,
  };
}

const tvSeries = title({
  id: 1,
  title: 'TV Series',
  type: 'tv',
  genres: [
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
    { id: 10765, name: 'Sci-Fi & Fantasy' },
  ],
});

const tvSeries2 = title({
  id: 2,
  title: 'TV Series 2',
  type: 'tv',
  genres: [{ id: 18, name: ' drama ' }],
});

test('gives every TV genre its own rail', () => {
  const rails = genreRailsFor([tvSeries, tvSeries2]);

  expect(rails.map((rail) => rail.genre)).toEqual([
    'Comedy',
    'Drama',
    'Sci-Fi & Fantasy',
  ]);
  expect(rails.find((rail) => rail.genre === 'Drama')?.items.map((item) => item.title)).toEqual([
    'TV Series',
    'TV Series 2',
  ]);
  expect(rails.find((rail) => rail.genre === 'Comedy')?.items).toHaveLength(1);
});

test('gives every movie genre its own rail', () => {
  const rails = genreRailsFor([
    title({
      id: 3,
      title: 'Amelie',
      type: 'movie',
      genres: [{ id: 35, name: 'Comedy' }],
    }),
    title({
      id: 4,
      title: 'Arrival',
      type: 'movie',
      genres: [{ id: 18, name: 'Drama' }],
    }),
  ]);

  expect(rails.map((rail) => rail.genre)).toEqual(['Comedy', 'Drama']);
  expect(rails.find((rail) => rail.genre === 'Comedy')?.items.map((item) => item.title)).toEqual([
    'Amelie',
  ]);
});
