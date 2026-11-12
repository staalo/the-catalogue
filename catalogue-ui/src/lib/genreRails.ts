import type { Media } from '@/types';

export type GenreRail = {
  genre: string;
  items: Media[];
};

export function genreRailsFor(items: Media[]): GenreRail[] {
  return genreNames(items)
    .map((genre) => ({
      genre,
      items: titlesInGenre(items, genre),
    }))
    .filter((rail) => rail.items.length > 0);
}

function genreNames(items: Media[]): string[] {
  const names = new Map<string, string>();
  for (const item of items) {
    for (const genre of item.genres) {
      const name = genre.name.trim();
      const key = genreKey(name);
      if (key && !names.has(key)) {
        names.set(key, name);
      }
    }
  }

  return [...names.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' }),
  );
}

function titlesInGenre(items: Media[], genre: string): Media[] {
  const target = genreKey(genre);
  return items.filter((item) =>
    item.genres.some((entry) => genreKey(entry.name) === target),
  );
}

function genreKey(name: string): string {
  return name.trim().toLowerCase();
}
