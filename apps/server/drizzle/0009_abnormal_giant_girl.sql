CREATE TABLE `active_hours` (
	`hour` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`hour`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `event_hours` (
	`hour` integer NOT NULL,
	`name` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`hour`, `name`)
);
--> statement-breakpoint
CREATE TABLE `plays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`video_id` text NOT NULL,
	`title` text,
	`artists` text,
	`duration_seconds` integer,
	`played_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plays_played_at_idx` ON `plays` (`played_at`);