import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const assets = sqliteTable(
  "assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull().default("legacy-owner"),
    category: text("category").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    quantity: real("quantity").notNull().default(1),
    unit: text("unit").notNull().default("item"),
    purity: real("purity").notNull().default(1),
    manualValueAud: real("manual_value_aud"),
    imageUrl: text("image_url").notNull().default(""),
    backImageUrl: text("back_image_url").notNull().default(""),
    serial: text("serial").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    scanStatus: text("scan_status").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_assets_owner_created").on(table.ownerId, table.createdAt),
    index("idx_assets_category").on(table.category),
    index("idx_assets_created_at").on(table.createdAt),
  ],
);

export const assetFinancials = sqliteTable("asset_financials", {
  assetKey: text("asset_key").primaryKey(),
  ownerId: text("owner_id").notNull().default("legacy-owner"),
  purchasePriceAud: real("purchase_price_aud"),
  purchaseDate: text("purchase_date").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_asset_financials_owner").on(table.ownerId),
]);
