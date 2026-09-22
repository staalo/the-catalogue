import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Users — replaces ASP.NET Identity AspNetUsers.
// Keeps the same string-based (GUID) primary key convention.
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
]);

// ---------------------------------------------------------------------------
// LocalMovies — main movie record, mirrors LocalMovieDb.cs.
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
});

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
// LocalMovieCast — mirrors LocalMovieCastDb.cs.
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
// LocalMovieCrew — mirrors LocalMovieCrewDb.cs.
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
// LocalMovieGenres — mirrors LocalMovieGenreDb.cs.
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
// LocalMovieExtras — mirrors LocalMovieExtraDb.cs.
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
// LocalMovieTrailers — mirrors LocalMovieTrailerDb.cs.
// One-to-one with LocalMovies (unique FK).
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
// TmdbApi — internal TMDb API config, mirrors TmDbApi.cs / SearchContext.
// Only one row expected in practice.
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
