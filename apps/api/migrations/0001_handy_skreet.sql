CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `login_tokens` ADD `request_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `login_tokens_request_key_idx` ON `login_tokens` (`email`,`request_key`);