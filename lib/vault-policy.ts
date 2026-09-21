export const DELETE_VAULT_CONFIRMATION = "DELETE MY VAULT";

export const SEED_ASSET_KEYS = [
  "carlos-prates-cav-cps-69-99",
  "valentina-shevchenko-tvn-35",
  "leon-edwards-86s-le-refractor",
  "kody-steele-cb-153-16-99",
  "carlos-leal-bav-cle-75-99",
  "jonathan-martinez-75-31-99",
  "virna-jandiroba-86s-vj-refractor",
  "nursulton-ruziboev-bav-nr",
  "nassourdine-imavov-c-76-78-99",
  "carlos-leal-71-107-150",
  "ludovit-klein-145-073-150",
  "gabriel-bonfim-114-366-399",
  "james-bond-60-years-1oz-silver",
] as const;

export type SeedAssetKey = (typeof SEED_ASSET_KEYS)[number];

export type VaultIdentityLike = {
  user: { id: string };
  isLegacyOwner: boolean;
  ownerIds: string[];
};

const SEED_KEY_SET = new Set<string>(SEED_ASSET_KEYS);
const STORED_ASSET_KEY = /^asset-(\d+)$/;
const SEED_PHOTO_PATH = /^\/(cards|metals)\/[^/]+\.(webp|png|jpe?g|gif)$/i;

export function storedAssetKey(id: number) {
  return `asset-${id}`;
}

export function parseStoredAssetId(assetKey: string) {
  const match = STORED_ASSET_KEY.exec(assetKey);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isSeedAssetKey(assetKey: string) {
  return SEED_KEY_SET.has(assetKey);
}

export function isSeedPhotoPath(pathname: string) {
  return SEED_PHOTO_PATH.test(pathname);
}

export function ownsOwnerId(identity: VaultIdentityLike, ownerId: string) {
  return identity.ownerIds.includes(ownerId);
}

export function accessOwnedRow<T extends { ownerId: string }>(
  row: T | undefined | null,
  identity: VaultIdentityLike,
  missingMessage = "Asset not found",
): { ok: true; row: T } | { ok: false; status: 403 | 404; error: string } {
  if (!row) return { ok: false, status: 404, error: missingMessage };
  if (!ownsOwnerId(identity, row.ownerId)) {
    return { ok: false, status: 403, error: "This item belongs to another vault" };
  }
  return { ok: true, row };
}

export function financialKeyWriteAccess(
  identity: VaultIdentityLike,
  assetKey: string,
  ownedAssetIds: Iterable<number>,
): { ok: true } | { ok: false; status: 400 | 403; error: string } {
  const storedId = parseStoredAssetId(assetKey);
  if (storedId !== null) {
    const owned = new Set(ownedAssetIds);
    if (!owned.has(storedId)) {
      return { ok: false, status: 403, error: "This item belongs to another vault" };
    }
    return { ok: true };
  }

  if (isSeedAssetKey(assetKey)) {
    if (!identity.isLegacyOwner) {
      return { ok: false, status: 403, error: "This item belongs to another vault" };
    }
    return { ok: true };
  }

  return { ok: false, status: 400, error: "Unknown asset" };
}

export function preferCurrentOwnerFinancial<T extends { assetKey: string; ownerId: string }>(
  rows: T[],
  identity: VaultIdentityLike,
) {
  const byKey = new Map<string, T>();
  for (const row of rows) {
    if (!ownsOwnerId(identity, row.ownerId)) continue;
    const existing = byKey.get(row.assetKey);
    if (!existing || row.ownerId === identity.user.id) byKey.set(row.assetKey, row);
  }
  return [...byKey.values()];
}

export function seedPhotoAccess(options: {
  pathname: string;
  userId: string | null;
  email: string | null;
  legacyOwnerUserId?: string;
}): "allow" | "unauthorized" | "not_found" | "skip" {
  if (!isSeedPhotoPath(options.pathname)) return "skip";
  if (!options.userId || !options.email) return "unauthorized";
  if (options.legacyOwnerUserId && options.userId !== options.legacyOwnerUserId) {
    return "not_found";
  }
  return "allow";
}

export function isDeleteVaultConfirmation(value: string) {
  return value.trim() === DELETE_VAULT_CONFIRMATION;
}

export function asFlag(value: boolean | number | null | undefined) {
  return value === true || value === 1;
}

export function flagColumn(value: boolean) {
  return value ? 1 : 0;
}
