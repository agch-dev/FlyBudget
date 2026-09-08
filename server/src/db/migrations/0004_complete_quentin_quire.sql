CREATE TABLE `plaid_account_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`plaid_item_id` text NOT NULL,
	`plaid_account_id` text NOT NULL,
	`account_id` text,
	`plaid_account_name` text NOT NULL,
	`plaid_account_type` text NOT NULL,
	`plaid_account_mask` text,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`plaid_item_id`) REFERENCES `plaid_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaid_account_mapping_unique` ON `plaid_account_mappings` (`plaid_item_id`,`plaid_account_id`);--> statement-breakpoint
CREATE TABLE `plaid_config` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`secret` text NOT NULL,
	`environment` text DEFAULT 'sandbox' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plaid_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plaid_item_id` text NOT NULL,
	`institution_id` text NOT NULL,
	`institution_name` text NOT NULL,
	`access_token` text NOT NULL,
	`cursor` text,
	`last_synced_at` text,
	`sync_status` text DEFAULT 'good' NOT NULL,
	`sync_error` text,
	`consent_expires_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
