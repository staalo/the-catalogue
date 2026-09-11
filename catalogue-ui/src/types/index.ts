export type MediaType = 'movie' | 'tv';

export type Extra = {
  id: number;
  title: string;
  runtime: string;
  url: string;
};

export type Genre = {
  id: number;
  name: string | null;
};

export type NamedGenre = {
  id: number;
  name: string;
};

export type CastMember = {
  id: number;
  adult: boolean;
  castId: number;
  character: string | null;
  creditId: string | null;
  gender: number | null;
  knownForDepartment: string | null;
  name: string | null;
  order: number;
  originalName: string | null;
  popularity: number;
  profilePath: string | null;
};

export type CrewMember = {
  id: number;
  adult: boolean;
  creditId: string | null;
  department: string | null;
  gender: number | null;
  job: string | null;
  knownForDepartment: string | null;
  name: string | null;
  originalName: string | null;
  popularity: number;
  profilePath: string | null;
};

export type MovieResponse = {
  id: number;
  adult: boolean;
  homepage: string | null;
  imdbId: string | null;
  originalLanguage: string | null;
  originalTitle: string | null;
  overview: string | null;
  popularity: number;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number;
  tagline: string | null;
  title: string | null;
  voteAverage: number;
  voteCount: number;
  url: string;
  hasExtras: boolean;
  cast: CastMember[];
  crew: CrewMember[];
  genres: Genre[];
  extras: Extra[];
  progress?: number;
};

export type BrowseResult = {
  page: number;
  results: MovieResponse[];
  totalPages: number;
  totalResults: number;
};

export type SearchResult = {
  query: string;
  totalResults: number;
  results: MovieResponse[];
};

export type Media = {
  id: number;
  title: string;
  type: MediaType;
  year: string;
  meta: string;
  image: string;
  backdrop: string;
  progress?: number;
  description: string;
  url?: string;
  extras?: Extra[];
  genres: NamedGenre[];
  tagline?: string;
};

export type CurrentUser = {
  email: string;
  userName: string;
};

export type MediaPaths = {
  moviesPath: string | null;
  tvPath: string | null;
};

export type UpdateMediaPathsRequest = {
  moviesPath?: string | null;
  tvPath?: string | null;
};

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type RegisterRequest = {
  email: string;
  password: string;
  userName?: string;
  moviesPath?: string;
};

export type RegisterResponse = {
  email: string;
  userName: string;
  moviesPath: string | null;
};

export type PlayerTarget = {
  title: string;
  subtitle: string;
  url: string;
  mediaId?: number;
};
