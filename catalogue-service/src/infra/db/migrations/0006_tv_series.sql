CREATE TABLE `local_series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adult` integer DEFAULT 0 NOT NULL,
	`homepage` text,
	`imdb_id` text,
	`original_language` text,
	`original_title` text,
	`overview` text,
	`popularity` real DEFAULT 0 NOT NULL,
	`poster_path` text,
	`backdrop_path` text,
	`release_date` text,
	`runtime` integer DEFAULT 0 NOT NULL,
	`tagline` text,
	`title` text,
	`vote_average` real DEFAULT 0 NOT NULL,
	`vote_count` integer DEFAULT 0 NOT NULL,
	`year` integer,
	`has_extras` integer DEFAULT 0 NOT NULL,
	`metadata_file` text,
	`tmdb_id` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_local_series_metadata_file` ON `local_series` (`metadata_file`);
--> statement-breakpoint
CREATE TABLE `local_series_nodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`series_id` integer NOT NULL,
	`parent_id` integer,
	`stable_key` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`title` text,
	`runtime` text,
	`url` text,
	`season_number` integer,
	`episode_number` integer,
	FOREIGN KEY (`series_id`) REFERENCES `local_series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `local_series_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_series_nodes_series_key` ON `local_series_nodes` (`series_id`,`stable_key`);
--> statement-breakpoint
CREATE INDEX `idx_series_nodes_series_id` ON `local_series_nodes` (`series_id`);
--> statement-breakpoint
CREATE INDEX `idx_series_nodes_parent_id` ON `local_series_nodes` (`parent_id`);
--> statement-breakpoint
CREATE TABLE `local_series_cast` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_series_id` integer NOT NULL,
	`adult` integer DEFAULT 0 NOT NULL,
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
	FOREIGN KEY (`local_series_id`) REFERENCES `local_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_series_cast_series_id` ON `local_series_cast` (`local_series_id`);
--> statement-breakpoint
CREATE TABLE `local_series_crew` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_series_id` integer NOT NULL,
	`adult` integer DEFAULT 0 NOT NULL,
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
	FOREIGN KEY (`local_series_id`) REFERENCES `local_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_series_crew_series_id` ON `local_series_crew` (`local_series_id`);
--> statement-breakpoint
CREATE TABLE `local_series_genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_series_id` integer NOT NULL,
	`genre_id` integer DEFAULT 0 NOT NULL,
	`name` text,
	FOREIGN KEY (`local_series_id`) REFERENCES `local_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_series_genres_series_id` ON `local_series_genres` (`local_series_id`);
--> statement-breakpoint
CREATE TABLE `local_series_trailers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`local_series_id` integer NOT NULL,
	`iso_639_1` text,
	`iso_3166_1` text,
	`name` text,
	`key` text,
	`site` text,
	`size` integer DEFAULT 0 NOT NULL,
	`type` text,
	`official` integer DEFAULT 0 NOT NULL,
	`published_at` text,
	`video_id` text,
	FOREIGN KEY (`local_series_id`) REFERENCES `local_series`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_series_trailers_local_series_id_unique` ON `local_series_trailers` (`local_series_id`);
--> statement-breakpoint
CREATE TABLE `tv_playback_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`node_id` integer NOT NULL,
	`progress_percent` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `local_series_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tv_playback_user_node` ON `tv_playback_progress` (`user_id`,`node_id`);
--> statement-breakpoint
CREATE INDEX `idx_tv_playback_user_updated` ON `tv_playback_progress` (`user_id`,`updated_at`);
