CREATE TABLE `local_media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_name` text,
	`movies_path` text,
	`tv_path` text
);
--> statement-breakpoint
CREATE TABLE `local_movie_cast` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_movie_id` integer NOT NULL,
	`adult` integer DEFAULT false NOT NULL,
	`cast_id` integer DEFAULT 0 NOT NULL,
	`character` text,
	`credit_id` text,
	`gender` integer,
	`person_id` integer DEFAULT 0 NOT NULL,
	`known_for_department` text,
	`name` text,
	`order` integer DEFAULT 0 NOT NULL,
	`original_name` text,
	`popularity` real DEFAULT 0 NOT NULL,
	`profile_path` text,
	FOREIGN KEY (`local_movie_id`) REFERENCES `local_movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cast_movie_id` ON `local_movie_cast` (`local_movie_id`);--> statement-breakpoint
CREATE TABLE `local_movie_crew` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_movie_id` integer NOT NULL,
	`adult` integer DEFAULT false NOT NULL,
	`credit_id` text,
	`department` text,
	`gender` integer,
	`person_id` integer DEFAULT 0 NOT NULL,
	`job` text,
	`known_for_department` text,
	`name` text,
	`original_name` text,
	`popularity` real DEFAULT 0 NOT NULL,
	`profile_path` text,
	FOREIGN KEY (`local_movie_id`) REFERENCES `local_movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_crew_movie_id` ON `local_movie_crew` (`local_movie_id`);--> statement-breakpoint
CREATE TABLE `local_movie_extras` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_movie_id` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`runtime` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`local_movie_id`) REFERENCES `local_movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_extras_movie_id` ON `local_movie_extras` (`local_movie_id`);--> statement-breakpoint
CREATE TABLE `local_movie_genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_movie_id` integer NOT NULL,
	`genre_id` integer DEFAULT 0 NOT NULL,
	`name` text,
	FOREIGN KEY (`local_movie_id`) REFERENCES `local_movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_genres_movie_id` ON `local_movie_genres` (`local_movie_id`);--> statement-breakpoint
CREATE TABLE `local_movie_trailers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_movie_id` integer NOT NULL,
	`iso_639_1` text,
	`iso_3166_1` text,
	`name` text,
	`key` text,
	`site` text,
	`size` integer DEFAULT 0 NOT NULL,
	`type` text,
	`official` integer DEFAULT false NOT NULL,
	`published_at` text,
	`video_id` text,
	FOREIGN KEY (`local_movie_id`) REFERENCES `local_movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_movie_trailers_local_movie_id_unique` ON `local_movie_trailers` (`local_movie_id`);--> statement-breakpoint
CREATE TABLE `local_movies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adult` integer DEFAULT false NOT NULL,
	`homepage` text,
	`imdb_id` text,
	`original_language` text,
	`original_title` text,
	`overview` text,
	`popularity` real DEFAULT 0 NOT NULL,
	`poster_path` text,
	`release_date` text,
	`runtime` integer DEFAULT 0 NOT NULL,
	`tagline` text,
	`title` text,
	`vote_average` real DEFAULT 0 NOT NULL,
	`vote_count` integer DEFAULT 0 NOT NULL,
	`url` text NOT NULL,
	`has_extras` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tmdb_api` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`api_base_url` text,
	`api_key` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`user_name` text NOT NULL,
	`normalized_user_name` text,
	`email` text,
	`normalized_email` text,
	`password_hash` text,
	`security_stamp` text,
	`concurrency_stamp` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username` ON `users` (`normalized_user_name`);