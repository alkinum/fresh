CREATE INDEX `backup_import_receipts_user_created_at_idx` ON `backup_import_receipts` (`user_id`,`created_at`);--> statement-breakpoint
UPDATE `tags`
SET
	`last_note_modified_at` = (
		SELECT max(`duplicates`.`last_note_modified_at`)
		FROM `tags` AS `duplicates`
		WHERE `duplicates`.`user_id` = `tags`.`user_id` AND `duplicates`.`name` = `tags`.`name`
	),
	`created_at` = (
		SELECT min(`duplicates`.`created_at`)
		FROM `tags` AS `duplicates`
		WHERE `duplicates`.`user_id` = `tags`.`user_id` AND `duplicates`.`name` = `tags`.`name`
	),
	`updated_at` = (
		SELECT max(`duplicates`.`updated_at`)
		FROM `tags` AS `duplicates`
		WHERE `duplicates`.`user_id` = `tags`.`user_id` AND `duplicates`.`name` = `tags`.`name`
	)
WHERE `tags`.`id` = (
	SELECT min(`canonical`.`id`)
	FROM `tags` AS `canonical`
	WHERE `canonical`.`user_id` = `tags`.`user_id` AND `canonical`.`name` = `tags`.`name`
);--> statement-breakpoint
INSERT OR IGNORE INTO `note_tags` (`note_id`, `tag_id`)
SELECT `note_tags`.`note_id`, `canonical`.`id`
FROM `note_tags`
INNER JOIN `tags` AS `duplicate` ON `duplicate`.`id` = `note_tags`.`tag_id`
INNER JOIN (
	SELECT `user_id`, `name`, min(`id`) AS `id`
	FROM `tags`
	GROUP BY `user_id`, `name`
) AS `canonical`
	ON `canonical`.`user_id` = `duplicate`.`user_id` AND `canonical`.`name` = `duplicate`.`name`;--> statement-breakpoint
DELETE FROM `tags`
WHERE `id` NOT IN (
	SELECT min(`id`)
	FROM `tags`
	GROUP BY `user_id`, `name`
);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_user_name_unique` ON `tags` (`user_id`,`name`);
