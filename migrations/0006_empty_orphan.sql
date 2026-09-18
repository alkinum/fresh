CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'auto' NOT NULL,
	`theme` text DEFAULT 'auto' NOT NULL,
	`accent` text DEFAULT 'blue' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
