import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "../db";
import { assets, valuationHistory } from "../db/schema";
import { financialKeyWriteAccess, type VaultIdentityLike } from "./vault-policy";

export type ValuationWrite = {
  assetKey: string;
  checkedAt: string;
  evidenceKind: "sold" | "asking" | "stored_note";
  matchKind: "exact" | "comparable" | "unknown";
  conditionKind: "raw" | "graded" | "unknown";
  confidence: "none" | "low" | "moderate" | "high";
  rangeAudLow: number | null;
  rangeAudHigh: number | null;
  rangeUsdLow: number | null;
  rangeUsdHigh: number | null;
  sourceUrl: string;
  note: string;
};

export function serializeValuation(row: typeof valuationHistory.$inferSelect) {
  return {
    id: row.id,
    assetKey: row.assetKey,
    checkedAt: row.checkedAt,
    evidenceKind: row.evidenceKind,
    matchKind: row.matchKind,
    conditionKind: row.conditionKind,
    confidence: row.confidence,
    rangeAudLow: row.rangeAudLow,
    rangeAudHigh: row.rangeAudHigh,
    rangeUsdLow: row.rangeUsdLow,
    rangeUsdHigh: row.rangeUsdHigh,
    sourceUrl: row.sourceUrl,
    note: row.note,
    createdAt: row.createdAt,
  };
}

async function loadOwnedAssetIds(identity: VaultIdentityLike) {
  const rows = await getDb()
    .select({ id: assets.id })
    .from(assets)
    .where(inArray(assets.ownerId, identity.ownerIds));
  return rows.map((row) => row.id);
}

export async function listOwnedValuations(identity: VaultIdentityLike, assetKey?: string) {
  const filters = [inArray(valuationHistory.ownerId, identity.ownerIds)];
  if (assetKey) filters.push(eq(valuationHistory.assetKey, assetKey));
  return getDb()
    .select()
    .from(valuationHistory)
    .where(and(...filters))
    .orderBy(desc(valuationHistory.checkedAt), desc(valuationHistory.id))
    .limit(200);
}

export async function insertOwnedValuation(identity: VaultIdentityLike, value: ValuationWrite) {
  const ownedAssetIds = await loadOwnedAssetIds(identity);
  const allowed = financialKeyWriteAccess(identity, value.assetKey, ownedAssetIds);
  if (!allowed.ok) return allowed;

  const [row] = await getDb()
    .insert(valuationHistory)
    .values({
      ownerId: identity.user.id,
      assetKey: value.assetKey,
      checkedAt: value.checkedAt,
      evidenceKind: value.evidenceKind,
      matchKind: value.matchKind,
      conditionKind: value.conditionKind,
      confidence: value.confidence,
      rangeAudLow: value.rangeAudLow,
      rangeAudHigh: value.rangeAudHigh,
      rangeUsdLow: value.rangeUsdLow,
      rangeUsdHigh: value.rangeUsdHigh,
      sourceUrl: value.sourceUrl,
      note: value.note,
    })
    .returning();
  return { ok: true as const, valuation: row };
}

export async function deleteValuationsForAsset(identity: VaultIdentityLike, assetKey: string) {
  await getDb()
    .delete(valuationHistory)
    .where(and(eq(valuationHistory.assetKey, assetKey), inArray(valuationHistory.ownerId, identity.ownerIds)));
}

export async function deleteOwnedValuations(identity: VaultIdentityLike) {
  await getDb().delete(valuationHistory).where(inArray(valuationHistory.ownerId, identity.ownerIds));
}
