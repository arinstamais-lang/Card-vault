CREATE TABLE `valuation_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`asset_key` text NOT NULL,
	`checked_at` text NOT NULL,
	`evidence_kind` text NOT NULL,
	`match_kind` text NOT NULL,
	`condition_kind` text NOT NULL,
	`confidence` text DEFAULT 'none' NOT NULL,
	`range_aud_low` real,
	`range_aud_high` real,
	`range_usd_low` real,
	`range_usd_high` real,
	`source_url` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_valuation_history_owner_asset` ON `valuation_history` (`owner_id`,`asset_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_valuation_history_owner` ON `valuation_history` (`owner_id`);
