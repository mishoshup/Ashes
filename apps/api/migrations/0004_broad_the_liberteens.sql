ALTER TABLE `check_ins` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `check_ins_user_client_idx` ON `check_ins` (`user_id`,`client_id`);