CREATE TABLE `recurring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`is_approximate` integer DEFAULT 0 NOT NULL,
	`frequency` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`account_id` text,
	`category_id` text,
	`payee_id` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`auto_create` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurring_transaction_id` text REFERENCES recurring_transactions(id);--> statement-breakpoint
CREATE INDEX `transactions_recurring_idx` ON `transactions` (`recurring_transaction_id`);