CREATE TABLE `kanban_boards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kanban_boards_user_id_idx` ON `kanban_boards` (`user_id`);--> statement-breakpoint
CREATE INDEX `kanban_boards_user_position_idx` ON `kanban_boards` (`user_id`,`position`);--> statement-breakpoint
CREATE TABLE `kanban_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`column_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `kanban_boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`column_id`) REFERENCES `kanban_columns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kanban_cards_column_position_idx` ON `kanban_cards` (`column_id`,`position`);--> statement-breakpoint
CREATE INDEX `kanban_cards_board_id_idx` ON `kanban_cards` (`board_id`);--> statement-breakpoint
CREATE INDEX `kanban_cards_user_id_idx` ON `kanban_cards` (`user_id`);--> statement-breakpoint
CREATE TABLE `kanban_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `kanban_boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kanban_columns_board_position_idx` ON `kanban_columns` (`board_id`,`position`);--> statement-breakpoint
CREATE INDEX `kanban_columns_user_id_idx` ON `kanban_columns` (`user_id`);