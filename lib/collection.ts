import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import { assetFinancials, assets } from "../db/schema";
import {
  accessOwnedRow,
  asFlag,
  financialKeyWriteAccess,
  flagColumn,
  preferCurrentOwnerFinancial,
  storedAssetKey,
  type VaultIdentityLike,
} from "./vault-policy";
import { r2KeysForAsset } from "./vault-media";
import { getBucket } from "./storage";
import { deleteOwnedValuations, deleteValuationsForAsset } from "./valuation-store";

export function serializeAsset(row: typeof assets.$inferSelect) {
  return {
    ...row,
    wishlist: asFlag(row.wishlist),
    showcase: asFlag(row.showcase),
  };
}

export function collectionErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table") || message.includes('from "assets"') || message.includes("asset_financials")) {
    return "The collection database is still being prepared. Try again after the next publish.";
  }
  return fallback;
}

export async function listOwnedAssets(identity: VaultIdentityLike) {
  return getDb()
    .select()
    .from(assets)
    .where(inArray(assets.ownerId, identity.ownerIds))
    .orderBy(desc(assets.createdAt), desc(assets.id))
    .limit(200);
}

export async function listOwnedFinancials(identity: VaultIdentityLike) {
  const rows = await getDb()
    .select()
    .from(assetFinancials)
    .where(inArray(assetFinancials.ownerId, identity.ownerIds))
    .limit(500);
  return preferCurrentOwnerFinancial(rows, identity);
}

export async function loadOwnedAssetIds(identity: VaultIdentityLike) {
  const rows = await getDb()
    .select({ id: assets.id })
    .from(assets)
    .where(inArray(assets.ownerId, identity.ownerIds));
  return rows.map((row) => row.id);
}

export async function getAssetById(id: number) {
  const [row] = await getDb().select().from(assets).where(eq(assets.id, id)).limit(1);
  return row ?? null;
}

export async function requireOwnedAsset(identity: VaultIdentityLike, id: number) {
  return accessOwnedRow(await getAssetById(id), identity);
}

export async function upsertOwnedFinancial(
  identity: VaultIdentityLike,
  value: { assetKey: string; purchasePriceAud: number | null; purchaseDate: string },
) {
  const ownedAssetIds = await loadOwnedAssetIds(identity);
  const allowed = financialKeyWriteAccess(identity, value.assetKey, ownedAssetIds);
  if (!allowed.ok) return allowed;

  const existingRows = await getDb()
    .select()
    .from(assetFinancials)
    .where(and(eq(assetFinancials.assetKey, value.assetKey), inArray(assetFinancials.ownerId, identity.ownerIds)))
    .limit(4);
  const existing =
    existingRows.find((row) => row.ownerId === identity.user.id) || existingRows[0] || null;
  const updatedAt = new Date().toISOString();

  if (existing) {
    const [financial] = await getDb()
      .update(assetFinancials)
      .set({
        purchasePriceAud: value.purchasePriceAud,
        purchaseDate: value.purchaseDate,
        updatedAt,
      })
      .where(and(eq(assetFinancials.ownerId, existing.ownerId), eq(assetFinancials.assetKey, existing.assetKey)))
      .returning();
    return { ok: true as const, financial };
  }

  const [financial] = await getDb()
    .insert(assetFinancials)
    .values({
      assetKey: value.assetKey,
      purchasePriceAud: value.purchasePriceAud,
      purchaseDate: value.purchaseDate,
      ownerId: identity.user.id,
      updatedAt,
    })
    .returning();
  return { ok: true as const, financial };
}

export async function deleteScanObjects(scanKeys: string[]) {
  if (scanKeys.length === 0) return;
  let bucket: ReturnType<typeof getBucket>;
  try {
    bucket = getBucket();
  } catch {
    return;
  }
  await Promise.allSettled(scanKeys.map((key) => bucket.delete(key)));
}

export async function deleteOwnedAsset(identity: VaultIdentityLike, id: number) {
  const owned = await requireOwnedAsset(identity, id);
  if (!owned.ok) return owned;

  const scanKeys = r2KeysForAsset(owned.row);
  const assetKey = storedAssetKey(owned.row.id);

  await getDb()
    .delete(assetFinancials)
    .where(and(eq(assetFinancials.assetKey, assetKey), inArray(assetFinancials.ownerId, identity.ownerIds)));
  await deleteValuationsForAsset(identity, assetKey);
  await getDb()
    .delete(assets)
    .where(and(eq(assets.id, owned.row.id), inArray(assets.ownerId, identity.ownerIds)));
  await deleteScanObjects(scanKeys);

  return { ok: true as const, id: owned.row.id };
}

export async function deleteOwnedCollection(identity: VaultIdentityLike) {
  const rows = await listOwnedAssets(identity);
  const scanKeys = [...new Set(rows.flatMap((row) => r2KeysForAsset(row)))];

  await getDb().delete(assetFinancials).where(inArray(assetFinancials.ownerId, identity.ownerIds));
  await deleteOwnedValuations(identity);
  await getDb().delete(assets).where(inArray(assets.ownerId, identity.ownerIds));
  await deleteScanObjects(scanKeys);

  return {
    deletedAssets: rows.length,
    deletedImages: scanKeys.length,
  };
}

export function patchValuesFromInput(input: {
  name?: string;
  description?: string;
  serial?: string;
  sourceUrl?: string;
  manualValueAud?: number | null;
  quantity?: number;
  purity?: number;
  unit?: "item" | "g" | "oz";
  wishlist?: boolean;
  showcase?: boolean;
}) {
  const values: Partial<{
    name: string;
    description: string;
    serial: string;
    sourceUrl: string;
    manualValueAud: number | null;
    quantity: number;
    purity: number;
    unit: "item" | "g" | "oz";
    wishlist: number;
    showcase: number;
  }> = {};

  if (input.name !== undefined) values.name = input.name;
  if (input.description !== undefined) values.description = input.description;
  if (input.serial !== undefined) values.serial = input.serial;
  if (input.sourceUrl !== undefined) values.sourceUrl = input.sourceUrl;
  if (input.manualValueAud !== undefined) values.manualValueAud = input.manualValueAud;
  if (input.quantity !== undefined) values.quantity = input.quantity;
  if (input.purity !== undefined) values.purity = input.purity;
  if (input.unit !== undefined) values.unit = input.unit;
  if (input.wishlist !== undefined) values.wishlist = flagColumn(input.wishlist);
  if (input.showcase !== undefined) values.showcase = flagColumn(input.showcase);
  return values;
}
