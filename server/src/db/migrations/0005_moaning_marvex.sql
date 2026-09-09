CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_amount` integer NOT NULL,
	`current_amount` integer DEFAULT 0 NOT NULL,
	`target_date` text,
	`account_id` text,
	`icon` text DEFAULT '🎯' NOT NULL,
	`color` text DEFAULT '#2563EB' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
