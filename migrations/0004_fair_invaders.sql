CREATE TABLE `backup_import_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`note_count` integer NOT NULL,
	`tag_count` integer NOT NULL,
	`board_count` integer NOT NULL,
	`attachment_count` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `backup_import_receipts_user_id_idx` ON `backup_import_receipts` (`user_id`);