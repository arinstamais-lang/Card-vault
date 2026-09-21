const SCAN_KEY_PATTERN = /^scans\/[A-Za-z0-9._-]+$/;

export function r2KeyFromVaultUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://vault.local");
    if (url.pathname !== "/api/card-image") return null;
    const key = url.searchParams.get("key") || "";
    if (!SCAN_KEY_PATTERN.test(key) || key.includes("..")) return null;
    return key;
  } catch {
    return null;
  }
}

export function r2KeysForAsset(asset: { imageUrl?: string; backImageUrl?: string }) {
  return [r2KeyFromVaultUrl(asset.imageUrl || ""), r2KeyFromVaultUrl(asset.backImageUrl || "")].filter(
    (key): key is string => Boolean(key),
  );
}

export function zipImageName(key: string) {
  return `images/${key.replaceAll("/", "-")}`;
}
