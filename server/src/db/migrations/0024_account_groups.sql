-- An Account Group is just the name its accounts share (the pesos and dollars sides of one
-- credit card). No table and no unique rule: a group exists while an account names it.
ALTER TABLE `accounts` ADD `group_name` text;
