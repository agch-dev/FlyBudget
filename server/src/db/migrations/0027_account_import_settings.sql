-- How each account's bank files are read (date order, decimals, column mapping, card and
-- currency choices), remembered from its last import so every device uses them again.
-- JSON of `ImportSettings` (server/src/utils/importSettings.ts); null = never imported.
ALTER TABLE `accounts` ADD `import_settings` text;
