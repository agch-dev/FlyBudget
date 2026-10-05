-- Transfer suggestions the user dismissed: that pair of transactions is not suggested again.
-- `id` is the two transaction ids joined with ":", the smaller first, so the same pair is the
-- same row on every device. Deleting either transaction removes the row.
CREATE TABLE `transfer_suggestion_dismissals` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`other_transaction_id` text NOT NULL,
	`dismissed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`other_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transfer_dismissal_other` ON `transfer_suggestion_dismissals` (`other_transaction_id`);
