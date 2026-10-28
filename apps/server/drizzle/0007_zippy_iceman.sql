CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`level` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
