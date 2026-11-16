import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Users. Primary keys are strings.
// ---------------------------------------------------------------------------
export const users = sqliteTable('users', {
  id:                   text('id').primaryKey(),
  userName:             text('user_name').notNull(),
  normalizedUserName:   text('normalized_user_name'),
  email:                text('email'),
  normalizedEmail:      text('normalized_email'),
  passwordHash:         text('password_hash'),
  securityStamp:        text('security_stamp'),
  concurrencyStamp:     text('concurrency_stamp'),
  createdAt:            text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, (t) => [
  uniqueIndex('idx_users_username').on(t.normalizedUserName),
  uniqueIndex('idx_users_email').on(t.normalizedEmail),
]);

// ---------------------------------------------------------------------------
// Local movies.
// ---------------------------------------------------------------------------
export const localMovies = sqliteTable('local_movies', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  adult:            integer('adult',      { mode: 'boolean' }).notNull().default(false),
  homepage:         text('homepage'),
  imdbId:           text('imdb_id'),
  originalLanguage: text('original_language'),
  originalTitle:    text('original_title'),
  overview:         text('overview'),
  popularity:       real('popularity').notNull().default(0),
  posterPath:       text('poster_path'),
  backdropPath:     text('backdrop_path'),
  releaseDate:      text('release_date'),
  runtime:          integer('runtime').notNull().default(0),
  tagline:          text('tagline'),
  title:            text('title'),
  voteAverage:      real('vote_average').notNull().default(0),
  voteCount:        integer('vote_count').notNull().default(0),
  /** Relative file URL used by the stream module */
  url:              text('url').notNull(),
  hasExtras:        integer('has_extras', { mode: 'boolean' }).notNull().default(false),
  /** Absolute path of the top-level library JSON that produced this row. */
  metadataFile:     text('metadata_file'),
}, (t) => [
  index('idx_local_movies_metadata_file').on(t.metadataFile),
]);

// ---------------------------------------------------------------------------
// PlaybackProgress — per-user movie resume state shared across devices.
// ---------------------------------------------------------------------------
export const playbackProgress = sqliteTable('playback_progress', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  userId:          text('user_id').notNull()
                     .references(() => users.id, { onDelete: 'cascade' }),
  localMovieId:    integer('local_movie_id').notNull()
                     .references(() => localMovies.id, { onDelete: 'cascade' }),
  progressPercent: real('progress_percent').notNull().default(0),
  updatedAt:       text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('idx_playback_progress_user_movie').on(t.userId, t.localMovieId),
  index('idx_playback_progress_user_updated').on(t.userId, t.updatedAt),
]);

// ---------------------------------------------------------------------------
// Cast credited on a local movie.
// ---------------------------------------------------------------------------
export const localMovieCast = sqliteTable('local_movie_cast', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  localMovieId:         integer('local_movie_id').notNull()
                          .references(() => localMovies.id, { onDelete: 'cascade' }),
  adult:                integer('adult',  { mode: 'boolean' }).notNull().default(false),
  castId:               integer('cast_id').notNull().default(0),
  character:            text('character'),
  creditId:             text('credit_id'),
  gender:               integer('gender'),
  personId:             integer('person_id').notNull().default(0),
  knownForDepartment:   text('known_for_department'),
  name:                 text('name'),
  order:                integer('order').notNull().default(0),
  originalName:         text('original_name'),
  popularity:           real('popularity').notNull().default(0),
  profilePath:          text('profile_path'),
}, (t) => [
  index('idx_cast_movie_id').on(t.localMovieId),
]);

// ---------------------------------------------------------------------------
// Crew credited on a local movie.
// ---------------------------------------------------------------------------
export const localMovieCrew = sqliteTable('local_movie_crew', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  localMovieId:         integer('local_movie_id').notNull()
                          .references(() => localMovies.id, { onDelete: 'cascade' }),
  adult:                integer('adult',  { mode: 'boolean' }).notNull().default(false),
  creditId:             text('credit_id'),
  department:           text('department'),
  gender:               integer('gender'),
  personId:             integer('person_id').notNull().default(0),
  job:                  text('job'),
  knownForDepartment:   text('known_for_department'),
  name:                 text('name'),
  originalName:         text('original_name'),
  popularity:           real('popularity').notNull().default(0),
  profilePath:          text('profile_path'),
}, (t) => [
  index('idx_crew_movie_id').on(t.localMovieId),
]);

// ---------------------------------------------------------------------------
// Genres for a local movie.
// ---------------------------------------------------------------------------
export const localMovieGenres = sqliteTable('local_movie_genres', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  localMovieId: integer('local_movie_id').notNull()
                  .references(() => localMovies.id, { onDelete: 'cascade' }),
  genreId:      integer('genre_id').notNull().default(0),
  name:         text('name'),
}, (t) => [
  index('idx_genres_movie_id').on(t.localMovieId),
]);

// ---------------------------------------------------------------------------
// Extras attached to a local movie.
// ---------------------------------------------------------------------------
export const localMovieExtras = sqliteTable('local_movie_extras', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  localMovieId: integer('local_movie_id').notNull()
                  .references(() => localMovies.id, { onDelete: 'cascade' }),
  title:        text('title').notNull().default(''),
  runtime:      text('runtime').notNull().default(''),
  url:          text('url').notNull().default(''),
}, (t) => [
  index('idx_extras_movie_id').on(t.localMovieId),
]);

// ---------------------------------------------------------------------------
// Trailer for a local movie. One-to-one with local movies (unique foreign key).
// ---------------------------------------------------------------------------
export const localMovieTrailers = sqliteTable('local_movie_trailers', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  localMovieId: integer('local_movie_id').notNull().unique()
                  .references(() => localMovies.id, { onDelete: 'cascade' }),
  iso6391:      text('iso_639_1'),
  iso31661:     text('iso_3166_1'),
  name:         text('name'),
  key:          text('key'),
  site:         text('site'),
  size:         integer('size').notNull().default(0),
  type:         text('type'),
  official:     integer('official', { mode: 'boolean' }).notNull().default(false),
  publishedAt:  text('published_at'),
  videoId:      text('video_id'),
});

// ---------------------------------------------------------------------------
// TMDb API config. Only one row is expected.
// ---------------------------------------------------------------------------
export const tmdbApi = sqliteTable('tmdb_api', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  apiBaseUrl: text('api_base_url'),
  apiKey:     text('api_key'),
});

// ---------------------------------------------------------------------------
// ScanStatus — tracks media directory scan history and progress.
// Allows users to trigger scans and check status.
// ---------------------------------------------------------------------------
export const scanStatus = sqliteTable('scan_status', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  userName:         text('user_name').notNull(),
  scanType:         text('scan_type').notNull(), // 'movies' or 'tv'
  status:           text('status').notNull(), // 'running' | 'completed' | 'failed'
  totalFiles:       integer('total_files').notNull().default(0),
  processedFiles:   integer('processed_files').notNull().default(0),
  skippedFiles:     integer('skipped_files').notNull().default(0),
  errorCount:       integer('error_count').notNull().default(0),
  startTime:        text('start_time').notNull(),
  endTime:          text('end_time'),
  errorLog:         text('error_log'), // JSON array of errors
  createdAt:        text('created_at').notNull().default('CURRENT_TIMESTAMP'),
}, (t) => [
  index('idx_scan_user_time').on(t.userName, t.startTime),
]);

// ---------------------------------------------------------------------------
// LocalSeries — one row per TV-series manifest.
// Playable episodes, versions, and extras live in local_series_nodes.
// ---------------------------------------------------------------------------
export const localSeries = sqliteTable('local_series', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  adult:            integer('adult', { mode: 'boolean' }).notNull().default(false),
  homepage:         text('homepage'),
  imdbId:           text('imdb_id'),
  originalLanguage: text('original_language'),
  originalTitle:    text('original_title'),
  overview:         text('overview'),
  popularity:       real('popularity').notNull().default(0),
  posterPath:       text('poster_path'),
  backdropPath:     text('backdrop_path'),
  releaseDate:      text('release_date'),
  /** Typical episode length in minutes, from TMDB when available. */
  runtime:          integer('runtime').notNull().default(0),
  tagline:          text('tagline'),
  title:            text('title'),
  voteAverage:      real('vote_average').notNull().default(0),
  voteCount:        integer('vote_count').notNull().default(0),
  /** Release year from the manifest DVD.Year field. */
  year:             integer('year'),
  hasExtras:        integer('has_extras', { mode: 'boolean' }).notNull().default(false),
  /** Absolute path of the top-level library JSON that produced this row. */
  metadataFile:     text('metadata_file'),
  tmdbId:           integer('tmdb_id'),
}, (t) => [
  uniqueIndex('idx_local_series_metadata_file').on(t.metadataFile),
]);

// ---------------------------------------------------------------------------
// LocalSeriesNodes — the manifest tree.
// A node is a season, episode, version, extras group, or playable file.
// stable_key keeps the same row (and playback progress) across rescans.
// ---------------------------------------------------------------------------
export const localSeriesNodes = sqliteTable('local_series_nodes', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  seriesId:        integer('series_id').notNull()
                     .references(() => localSeries.id, { onDelete: 'cascade' }),
  parentId:        integer('parent_id'),
  stableKey:       text('stable_key').notNull(),
  sortOrder:       integer('sort_order').notNull().default(0),
  /** season | episode | version | extras | group | media */
  kind:            text('kind').notNull(),
  /** JSON object key, unchanged. */
  label:           text('label').notNull(),
  /** Explicit Title, TMDB episode name, or a descriptive extra/version label. */
  title:           text('title'),
  /** Manifest duration string such as 44:31 or 1:30:09. */
  runtime:         text('runtime'),
  /** TMDB episode overview. */
  overview:        text('overview'),
  /** TMDB still path, the same shape as a poster path. */
  stillPath:       text('still_path'),
  /** Absolute media path. Null for seasons, groups, and multi-version episodes. */
  url:             text('url'),
  seasonNumber:    integer('season_number'),
  episodeNumber:   integer('episode_number'),
}, (t) => [
  uniqueIndex('idx_series_nodes_series_key').on(t.seriesId, t.stableKey),
  index('idx_series_nodes_series_id').on(t.seriesId),
  index('idx_series_nodes_parent_id').on(t.parentId),
]);

export const localSeriesCast = sqliteTable('local_series_cast', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  localSeriesId:        integer('local_series_id').notNull()
                          .references(() => localSeries.id, { onDelete: 'cascade' }),
  adult:                integer('adult',  { mode: 'boolean' }).notNull().default(false),
  castId:               integer('cast_id').notNull().default(0),
  character:            text('character'),
  creditId:             text('credit_id'),
  gender:               integer('gender'),
  personId:             integer('person_id').notNull().default(0),
  knownForDepartment:   text('known_for_department'),
  name:                 text('name'),
  order:                integer('order').notNull().default(0),
  originalName:         text('original_name'),
  popularity:           real('popularity').notNull().default(0),
  profilePath:          text('profile_path'),
}, (t) => [
  index('idx_series_cast_series_id').on(t.localSeriesId),
]);

export const localSeriesCrew = sqliteTable('local_series_crew', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  localSeriesId:        integer('local_series_id').notNull()
                          .references(() => localSeries.id, { onDelete: 'cascade' }),
  adult:                integer('adult',  { mode: 'boolean' }).notNull().default(false),
  creditId:             text('credit_id'),
  department:           text('department'),
  gender:               integer('gender'),
  personId:             integer('person_id').notNull().default(0),
  job:                  text('job'),
  knownForDepartment:   text('known_for_department'),
  name:                 text('name'),
  originalName:         text('original_name'),
  popularity:           real('popularity').notNull().default(0),
  profilePath:          text('profile_path'),
}, (t) => [
  index('idx_series_crew_series_id').on(t.localSeriesId),
]);

export const localSeriesGenres = sqliteTable('local_series_genres', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  localSeriesId: integer('local_series_id').notNull()
                   .references(() => localSeries.id, { onDelete: 'cascade' }),
  genreId:       integer('genre_id').notNull().default(0),
  name:          text('name'),
}, (t) => [
  index('idx_series_genres_series_id').on(t.localSeriesId),
]);

export const localSeriesTrailers = sqliteTable('local_series_trailers', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  localSeriesId: integer('local_series_id').notNull().unique()
                   .references(() => localSeries.id, { onDelete: 'cascade' }),
  iso6391:       text('iso_639_1'),
  iso31661:      text('iso_3166_1'),
  name:          text('name'),
  key:           text('key'),
  site:          text('site'),
  size:          integer('size').notNull().default(0),
  type:          text('type'),
  official:      integer('official', { mode: 'boolean' }).notNull().default(false),
  publishedAt:   text('published_at'),
  videoId:       text('video_id'),
});

// ---------------------------------------------------------------------------
// TvPlaybackProgress — per-user resume state for a playable series node.
// ---------------------------------------------------------------------------
export const tvPlaybackProgress = sqliteTable('tv_playback_progress', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  userId:          text('user_id').notNull()
                     .references(() => users.id, { onDelete: 'cascade' }),
  nodeId:          integer('node_id').notNull()
                     .references(() => localSeriesNodes.id, { onDelete: 'cascade' }),
  progressPercent: real('progress_percent').notNull().default(0),
  updatedAt:       text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('idx_tv_playback_user_node').on(t.userId, t.nodeId),
  index('idx_tv_playback_user_updated').on(t.userId, t.updatedAt),
]);

// ---------------------------------------------------------------------------
// Drizzle relations — required for the relational query API (db.query.*)
// ---------------------------------------------------------------------------
export const localMoviesRelations = relations(localMovies, ({ many, one }) => ({
  cast:    many(localMovieCast),
  crew:    many(localMovieCrew),
  genres:  many(localMovieGenres),
  extras:  many(localMovieExtras),
  trailer: one(localMovieTrailers, {
    fields:     [localMovies.id],
    references: [localMovieTrailers.localMovieId],
  }),
}));

export const localMovieCastRelations = relations(localMovieCast, ({ one }) => ({
  movie: one(localMovies, { fields: [localMovieCast.localMovieId], references: [localMovies.id] }),
}));

export const localMovieCrewRelations = relations(localMovieCrew, ({ one }) => ({
  movie: one(localMovies, { fields: [localMovieCrew.localMovieId], references: [localMovies.id] }),
}));

export const localMovieGenresRelations = relations(localMovieGenres, ({ one }) => ({
  movie: one(localMovies, { fields: [localMovieGenres.localMovieId], references: [localMovies.id] }),
}));

export const localMovieExtrasRelations = relations(localMovieExtras, ({ one }) => ({
  movie: one(localMovies, { fields: [localMovieExtras.localMovieId], references: [localMovies.id] }),
}));

export const localMovieTrailersRelations = relations(localMovieTrailers, ({ one }) => ({
  movie: one(localMovies, { fields: [localMovieTrailers.localMovieId], references: [localMovies.id] }),
}));

export const localSeriesRelations = relations(localSeries, ({ many, one }) => ({
  cast:    many(localSeriesCast),
  crew:    many(localSeriesCrew),
  genres:  many(localSeriesGenres),
  nodes:   many(localSeriesNodes),
  trailer: one(localSeriesTrailers, {
    fields:     [localSeries.id],
    references: [localSeriesTrailers.localSeriesId],
  }),
}));

export const localSeriesNodesRelations = relations(localSeriesNodes, ({ one, many }) => ({
  series: one(localSeries, {
    fields: [localSeriesNodes.seriesId],
    references: [localSeries.id],
  }),
  parent: one(localSeriesNodes, {
    fields: [localSeriesNodes.parentId],
    references: [localSeriesNodes.id],
    relationName: 'seriesNodeChildren',
  }),
  children: many(localSeriesNodes, { relationName: 'seriesNodeChildren' }),
}));

export const localSeriesCastRelations = relations(localSeriesCast, ({ one }) => ({
  series: one(localSeries, {
    fields: [localSeriesCast.localSeriesId],
    references: [localSeries.id],
  }),
}));

export const localSeriesCrewRelations = relations(localSeriesCrew, ({ one }) => ({
  series: one(localSeries, {
    fields: [localSeriesCrew.localSeriesId],
    references: [localSeries.id],
  }),
}));

export const localSeriesGenresRelations = relations(localSeriesGenres, ({ one }) => ({
  series: one(localSeries, {
    fields: [localSeriesGenres.localSeriesId],
    references: [localSeries.id],
  }),
}));

export const localSeriesTrailersRelations = relations(localSeriesTrailers, ({ one }) => ({
  series: one(localSeries, {
    fields: [localSeriesTrailers.localSeriesId],
    references: [localSeries.id],
  }),
}));
