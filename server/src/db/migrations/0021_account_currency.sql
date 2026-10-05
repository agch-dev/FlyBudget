-- Every account holds one currency: pesos (UYU) or dollars (USD). Existing accounts are pesos.
ALTER TABLE `accounts` ADD `currency` text DEFAULT 'UYU' NOT NULL;
