ALTER TABLE `users` ADD `suspended_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `last_active_at` integer;--> statement-breakpoint
-- Existing accounts start from their most recent session.
UPDATE `users` SET `last_active_at` = (SELECT max(`last_seen_at`) FROM `sessions` WHERE `sessions`.`user_id` = `users`.`id`);
