ALTER TABLE `asset_financials` ADD `owner_id` text DEFAULT 'legacy-owner' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_asset_financials_owner` ON `asset_financials` (`owner_id`);--> statement-breakpoint
ALTER TABLE `assets` ADD `owner_id` text DEFAULT 'legacy-owner' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_assets_owner_created` ON `assets` (`owner_id`,`created_at`);