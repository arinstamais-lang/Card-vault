import "server-only";

import { getChatGPTUser } from "./chatgpt-auth";

export const LEGACY_OWNER_ID = "legacy-owner";

async function runtimeSetting(name: string) {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as Record<string, unknown>;
  const value = runtime[name];
  return typeof value === "string" ? value.trim() : "";
}

export async function getVaultIdentity() {
  const user = await getChatGPTUser();
  if (!user) return null;

  const legacyOwnerUserId = await runtimeSetting("VAULT_LEGACY_OWNER_ID");
  const isLegacyOwner = Boolean(legacyOwnerUserId && user.id === legacyOwnerUserId);

  return {
    user,
    isLegacyOwner,
    ownerIds: isLegacyOwner ? [user.id, LEGACY_OWNER_ID] : [user.id],
  };
}
