CREATE TABLE `playback_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`local_movie_id` integer NOT NULL,
	`progress_percent` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`local_movie_id`) REFERENCES `local_movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_playback_progress_user_movie` ON `playback_progress` (`user_id`,`local_movie_id`);--> statement-breakpoint
CREATE INDEX `idx_playback_progress_user_updated` ON `playback_progress` (`user_id`,`updated_at`);