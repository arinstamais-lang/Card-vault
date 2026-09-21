import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    wishlist: integer("wishlist").notNull().default(0),
    showcase: integer("showcase").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_assets_owner_created").on(table.ownerId, table.createdAt),
    index("idx_assets_category").on(table.category),
    index("idx_assets_created_at").on(table.createdAt),
  ],
);

export const assetFinancials = sqliteTable(
  "asset_financials",
  {
    ownerId: text("owner_id").notNull().default("legacy-owner"),
    assetKey: text("asset_key").notNull(),
    purchasePriceAud: real("purchase_price_aud"),
    purchaseDate: text("purchase_date").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.assetKey] }),
    index("idx_asset_financials_owner").on(table.ownerId),
  ],
);

export const valuationHistory = sqliteTable(
  "valuation_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id").notNull(),
    assetKey: text("asset_key").notNull(),
    checkedAt: text("checked_at").notNull(),
    evidenceKind: text("evidence_kind").notNull(),
    matchKind: text("match_kind").notNull(),
    conditionKind: text("condition_kind").notNull(),
    confidence: text("confidence").notNull().default("none"),
    rangeAudLow: real("range_aud_low"),
    rangeAudHigh: real("range_aud_high"),
    rangeUsdLow: real("range_usd_low"),
    rangeUsdHigh: real("range_usd_high"),
    sourceUrl: text("source_url").notNull().default(""),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_valuation_history_owner_asset").on(table.ownerId, table.assetKey, table.createdAt),
    index("idx_valuation_history_owner").on(table.ownerId),
  ],
);
