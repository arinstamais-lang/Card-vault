import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_RESERVED_PATHS, AUTH_SIGN_IN_PATH, AUTH_SIGN_OUT_PATH } from "../lib/github-oauth";
import { readSessionUser, safeRelativeReturnPath, type VaultUser } from "../lib/session";

export type { VaultUser };

async function runtimeSetting(name: string) {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as Record<string, unknown>;
  const value = runtime[name];
  return typeof value === "string" ? value.trim() : "";
}

export async function getUser(): Promise<VaultUser | null> {
  const requestHeaders = await headers();
  // Identity is the HMAC session cookie only. Never trust spoofable headers
  // such as oai-authenticated-user-* or Google/CF Access identity headers.
  return readSessionUser(requestHeaders.get("cookie"), await runtimeSetting("SESSION_SECRET"));
}

export async function requireUser(returnTo: string): Promise<VaultUser> {
  const user = await getUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function signInPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo, AUTH_RESERVED_PATHS);
  return `${AUTH_SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function signOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo, AUTH_RESERVED_PATHS);
  return `${AUTH_SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}
