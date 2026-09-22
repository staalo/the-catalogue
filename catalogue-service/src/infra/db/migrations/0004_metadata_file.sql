ALTER TABLE `local_movies` ADD `metadata_file` text;--> statement-breakpoint
CREATE INDEX `idx_local_movies_metadata_file` ON `local_movies` (`metadata_file`);
