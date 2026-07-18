CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`media_type` text NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_r2_key_unique` ON `attachments` (`r2_key`);--> statement-breakpoint
CREATE INDEX `attachments_note_id_idx` ON `attachments` (`note_id`);--> statement-breakpoint
CREATE INDEX `attachments_user_id_idx` ON `attachments` (`user_id`);--> statement-breakpoint
ALTER TABLE `notes` ADD `rendered_content` text DEFAULT '' NOT NULL;