-- Daily exchange rates: pesos per dollar (interbank, no spread), one row per date.
-- `fetched_at` is when the row was fetched (or typed in); `is_manual` rows were entered by
-- hand and are never overwritten by a fetch.
CREATE TABLE `exchange_rates` (
	`date` text PRIMARY KEY NOT NULL,
	`rate` real NOT NULL,
	`fetched_at` text NOT NULL,
	`is_manual` integer DEFAULT 0 NOT NULL
);
