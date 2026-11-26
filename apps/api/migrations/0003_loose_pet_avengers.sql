CREATE TABLE `check_in_tags` (
	`check_in_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`check_in_id`, `tag`),
	FOREIGN KEY (`check_in_id`) REFERENCES `check_ins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `check_in_tags_tag_idx` ON `check_in_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`answer` text NOT NULL,
	`feeling` text,
	`context` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `check_ins_user_created_idx` ON `check_ins` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `psych_topics` (
	`slug` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`reflection_prompt` text,
	`insight_body` text NOT NULL,
	`channel_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `psych_topics_trigger_unique` ON `psych_topics` (`trigger`);--> statement-breakpoint
CREATE INDEX `psych_topics_channel_idx` ON `psych_topics` (`channel_id`);