CREATE TABLE `asset_financials` (
	`asset_key` text PRIMARY KEY NOT NULL,
	`purchase_price_aud` real,
	`purchase_date` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
