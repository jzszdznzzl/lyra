CREATE TABLE `friendships` (
	`requester_id` text NOT NULL,
	`addressee_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer,
	PRIMARY KEY(`requester_id`, `addressee_id`),
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friendships_addressee_idx` ON `friendships` (`addressee_id`);--> statement-breakpoint
CREATE TABLE `shared_playlist_members` (
	`playlist_id` text NOT NULL,
	`user_id` text NOT NULL,
	`invited_at` integer NOT NULL,
	`joined_at` integer,
	PRIMARY KEY(`playlist_id`, `user_id`),
	FOREIGN KEY (`playlist_id`) REFERENCES `shared_playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shared_playlist_members_user_idx` ON `shared_playlist_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `shared_playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`invite_token` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `is_recent_shared_with_friends` integer DEFAULT false NOT NULL;