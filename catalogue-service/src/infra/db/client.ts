import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const DB_URL = process.env["DATABASE_URL"] ?? "./data/catalog.db";

const sqlite = new Database(DB_URL);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Ensure baseline schema exists for brand-new databases.
sqlite.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		user_name TEXT NOT NULL,
		normalized_user_name TEXT,
		email TEXT,
		normalized_email TEXT,
		password_hash TEXT,
		security_stamp TEXT,
		concurrency_stamp TEXT,
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
	ON users (normalized_user_name);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
	ON users (normalized_email);

	CREATE TABLE IF NOT EXISTS local_movies (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		adult INTEGER NOT NULL DEFAULT 0,
		homepage TEXT,
		imdb_id TEXT,
		original_language TEXT,
		original_title TEXT,
		overview TEXT,
		popularity REAL NOT NULL DEFAULT 0,
		poster_path TEXT,
		backdrop_path TEXT,
		release_date TEXT,
		runtime INTEGER NOT NULL DEFAULT 0,
		tagline TEXT,
		title TEXT,
		vote_average REAL NOT NULL DEFAULT 0,
		vote_count INTEGER NOT NULL DEFAULT 0,
		url TEXT NOT NULL,
		has_extras INTEGER NOT NULL DEFAULT 0,
		metadata_file TEXT
	);

	CREATE TABLE IF NOT EXISTS playback_progress (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id TEXT NOT NULL,
		local_movie_id INTEGER NOT NULL,
		progress_percent REAL NOT NULL DEFAULT 0,
		updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY(local_movie_id) REFERENCES local_movies(id) ON DELETE CASCADE
	);

	CREATE UNIQUE INDEX IF NOT EXISTS idx_playback_progress_user_movie
	ON playback_progress (user_id, local_movie_id);

	CREATE INDEX IF NOT EXISTS idx_playback_progress_user_updated
	ON playback_progress (user_id, updated_at);

	CREATE TABLE IF NOT EXISTS local_movie_cast (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		local_movie_id INTEGER NOT NULL,
		adult INTEGER NOT NULL DEFAULT 0,
		cast_id INTEGER NOT NULL DEFAULT 0,
		character TEXT,
		credit_id TEXT,
		gender INTEGER,
		person_id INTEGER NOT NULL DEFAULT 0,
		known_for_department TEXT,
		name TEXT,
		"order" INTEGER NOT NULL DEFAULT 0,
		original_name TEXT,
		popularity REAL NOT NULL DEFAULT 0,
		profile_path TEXT,
		FOREIGN KEY(local_movie_id) REFERENCES local_movies(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_cast_movie_id
	ON local_movie_cast (local_movie_id);

	CREATE TABLE IF NOT EXISTS local_movie_crew (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		local_movie_id INTEGER NOT NULL,
		adult INTEGER NOT NULL DEFAULT 0,
		credit_id TEXT,
		department TEXT,
		gender INTEGER,
		person_id INTEGER NOT NULL DEFAULT 0,
		job TEXT,
		known_for_department TEXT,
		name TEXT,
		original_name TEXT,
		popularity REAL NOT NULL DEFAULT 0,
		profile_path TEXT,
		FOREIGN KEY(local_movie_id) REFERENCES local_movies(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_crew_movie_id
	ON local_movie_crew (local_movie_id);

	CREATE TABLE IF NOT EXISTS local_movie_genres (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		local_movie_id INTEGER NOT NULL,
		genre_id INTEGER NOT NULL DEFAULT 0,
		name TEXT,
		FOREIGN KEY(local_movie_id) REFERENCES local_movies(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_genres_movie_id
	ON local_movie_genres (local_movie_id);

	CREATE TABLE IF NOT EXISTS local_movie_extras (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		local_movie_id INTEGER NOT NULL,
		title TEXT NOT NULL DEFAULT '',
		runtime TEXT NOT NULL DEFAULT '',
		url TEXT NOT NULL DEFAULT '',
		FOREIGN KEY(local_movie_id) REFERENCES local_movies(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_extras_movie_id
	ON local_movie_extras (local_movie_id);

	CREATE TABLE IF NOT EXISTS local_movie_trailers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		local_movie_id INTEGER NOT NULL UNIQUE,
		iso_639_1 TEXT,
		iso_3166_1 TEXT,
		name TEXT,
		"key" TEXT,
		site TEXT,
		size INTEGER NOT NULL DEFAULT 0,
		type TEXT,
		official INTEGER NOT NULL DEFAULT 0,
		published_at TEXT,
		video_id TEXT,
		FOREIGN KEY(local_movie_id) REFERENCES local_movies(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS tmdb_api (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		api_base_url TEXT,
		api_key TEXT
	);

	CREATE TABLE IF NOT EXISTS scan_status (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_name TEXT NOT NULL,
		scan_type TEXT NOT NULL,
		status TEXT NOT NULL,
		total_files INTEGER NOT NULL DEFAULT 0,
		processed_files INTEGER NOT NULL DEFAULT 0,
		skipped_files INTEGER NOT NULL DEFAULT 0,
		error_count INTEGER NOT NULL DEFAULT 0,
		start_time TEXT NOT NULL,
		end_time TEXT,
		error_log TEXT,
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_scan_user_time
	ON scan_status (user_name, start_time);
`);

const localMovieColumns = sqlite
	.prepare("PRAGMA table_info(local_movies)")
	.all() as Array<{ name: string }>;

if (!localMovieColumns.some((column) => column.name === "backdrop_path")) {
	sqlite.exec("ALTER TABLE local_movies ADD COLUMN backdrop_path TEXT;");
}

if (!localMovieColumns.some((column) => column.name === "metadata_file")) {
	sqlite.exec("ALTER TABLE local_movies ADD COLUMN metadata_file TEXT;");
}

sqlite.exec(`
	CREATE INDEX IF NOT EXISTS idx_local_movies_metadata_file
	ON local_movies (metadata_file);
`);

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;