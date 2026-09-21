ALTER TABLE `assets` ADD `wishlist` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `showcase` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `asset_financials_new` (
	`owner_id` text DEFAULT 'legacy-owner' NOT NULL,
	`asset_key` text NOT NULL,
	`purchase_price_aud` real,
	`purchase_date` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `asset_key`)
);--> statement-breakpoint
INSERT INTO `asset_financials_new` (`owner_id`, `asset_key`, `purchase_price_aud`, `purchase_date`, `updated_at`)
SELECT `owner_id`, `asset_key`, `purchase_price_aud`, `purchase_date`, `updated_at` FROM `asset_financials`;--> statement-breakpoint
DROP TABLE `asset_financials`;--> statement-breakpoint
ALTER TABLE `asset_financials_new` RENAME TO `asset_financials`;--> statement-breakpoint
CREATE INDEX `idx_asset_financials_owner` ON `asset_financials` (`owner_id`);
