CREATE TABLE `ark_dino_wipe_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`server` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ark_dino_wipe_blocks_server_unique` ON `ark_dino_wipe_blocks` (`server`);--> statement-breakpoint
CREATE TABLE `ark_dino_wipe` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`server` text,
	`poll_id` text NOT NULL,
	`success` integer DEFAULT true,
	`created_at` integer NOT NULL
);
