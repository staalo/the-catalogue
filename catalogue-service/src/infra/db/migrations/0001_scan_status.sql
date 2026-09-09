CREATE TABLE `scan_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_name` text NOT NULL,
	`scan_type` text NOT NULL,
	`status` text NOT NULL,
	`total_files` integer DEFAULT 0 NOT NULL,
	`processed_files` integer DEFAULT 0 NOT NULL,
	`skipped_files` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`error_log` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_scan_user_time` ON `scan_status` (`user_name`,`start_time`);--> statement-breakpoint
ALTER TABLE `local_movies` ADD `backdrop_path` text;