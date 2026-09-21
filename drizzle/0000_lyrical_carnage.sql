CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'item' NOT NULL,
	`purity` real DEFAULT 1 NOT NULL,
	`manual_value_aud` real,
	`image_url` text DEFAULT '' NOT NULL,
	`serial` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_assets_category` ON `assets` (`category`);--> statement-breakpoint
CREATE INDEX `idx_assets_created_at` ON `assets` (`created_at`);--> statement-breakpoint
PRAGMA optimize;
