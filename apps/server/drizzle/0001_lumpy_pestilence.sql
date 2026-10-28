CREATE TABLE `google_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`cookie_ciphertext` text NOT NULL,
	`method` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`photo` text,
	`linked_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
