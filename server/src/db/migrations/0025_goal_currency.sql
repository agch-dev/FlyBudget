-- A goal's amounts are in one currency: pesos (UYU) or dollars (USD). Existing goals take
-- their linked account's currency, and pesos when they have no account.
ALTER TABLE `goals` ADD `currency` text DEFAULT 'UYU' NOT NULL;--> statement-breakpoint
UPDATE `goals` SET `currency` = (SELECT `currency` FROM `accounts` WHERE `accounts`.`id` = `goals`.`account_id`)
WHERE `account_id` IN (SELECT `id` FROM `accounts`);
