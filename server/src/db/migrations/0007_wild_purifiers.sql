CREATE TABLE `simplefin_account_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`simplefin_account_id` text NOT NULL,
	`account_id` text,
	`simplefin_account_name` text NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `simplefin_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `simplefin_account_mapping_unique` ON `simplefin_account_mappings` (`connection_id`,`simplefin_account_id`);--> statement-breakpoint
CREATE TABLE `simplefin_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`access_url` text NOT NULL,
	`connection_name` text NOT NULL,
	`sync_status` text DEFAULT 'good' NOT NULL,
	`sync_error` text,
	`last_synced_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plaid_config` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`secret` text NOT NULL,
	`environment` text DEFAULT 'development' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_plaid_config`("id", "client_id", "secret", "environment", "created_at", "updated_at") SELECT "id", "client_id", "secret", "environment", "created_at", "updated_at" FROM `plaid_config`;--> statement-breakpoint
DROP TABLE `plaid_config`;--> statement-breakpoint
ALTER TABLE `__new_plaid_config` RENAME TO `plaid_config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;