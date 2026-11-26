ALTER TABLE `sessions` ADD `id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ip_hash` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `revoked_at` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `revoked_reason` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `rotated_from` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `sessions` SET `id` = 'ses_' || lower(hex(randomblob(16))) WHERE `id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_id_idx` ON `sessions` (`id`);--> statement-breakpoint
CREATE INDEX `sessions_user_revoked_idx` ON `sessions` (`user_id`,`revoked_at`);