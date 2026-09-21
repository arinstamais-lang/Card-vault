export const SESSION_COOKIE = "vault_session";
export const OAUTH_COOKIE = "vault_oauth";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
export const OAUTH_MAX_AGE_SEC = 10 * 60;
export const SESSION_TOKEN_VERSION = "v1";

export type VaultUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export type SessionPayload = {
  t: "session";
  id: string;
  email: string;
  displayName: string;
  fullName: string | null;
  iat: number;
  exp: number;
};

export type OAuthPendingPayload = {
  t: "oauth";
  nonce: string;
  verifier: string;
  returnTo: string;
  exp: number;
};

export type SignedPayload = SessionPayload | OAuthPendingPayload;

const encoder = new TextEncoder();

export function githubOwnerId(id: string | number) {
  return `github:${id}`;
}

export function safeRelativeReturnPath(value: string, reservedPathnames: readonly string[]) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (reservedPathnames.includes(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

export function parseCookieHeader(header: string | null | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return null;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean; httpOnly?: boolean },
) {
  const parts = [`${name}=${value}`, "Path=/", "SameSite=Lax", `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name: string, secure: boolean) {
  return serializeCookie(name, "", { maxAge: 0, secure });
}

export function requestIsHttps(request: Request) {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-proto");
  return url.protocol === "https:" || forwarded === "https";
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

async function hmacSha256(secret: string, value: string) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return new Uint8Array(signature);
}

export async function signPayload(payload: SignedPayload, secret: string) {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsigned = `${SESSION_TOKEN_VERSION}.${body}`;
  const signature = base64UrlEncode(await hmacSha256(secret, unsigned));
  return `${unsigned}.${signature}`;
}

export async function verifyPayload(token: string, secret: string): Promise<SignedPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SESSION_TOKEN_VERSION) return null;
  const [version, body, signature] = parts;
  let expected: Uint8Array;
  let actual: Uint8Array;
  try {
    expected = await hmacSha256(secret, `${version}.${body}`);
    actual = base64UrlDecode(signature);
  } catch {
    return null;
  }
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SignedPayload;
    if (!parsed || typeof parsed !== "object" || typeof parsed.exp !== "number") return null;
    if (parsed.exp * 1000 <= Date.now()) return null;
    if (parsed.t !== "session" && parsed.t !== "oauth") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function signSession(user: VaultUser, secret: string, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  return signPayload(
    {
      t: "session",
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      fullName: user.fullName,
      iat,
      exp: iat + SESSION_MAX_AGE_SEC,
    },
    secret,
  );
}

export function sessionUserFromPayload(payload: SignedPayload | null): VaultUser | null {
  if (!payload || payload.t !== "session") return null;
  if (!payload.id || !payload.email) return null;
  return {
    id: payload.id,
    email: payload.email,
    displayName: payload.displayName || payload.email,
    fullName: payload.fullName,
  };
}

export async function readSessionUser(cookieHeader: string | null | undefined, secret: string | null | undefined) {
  if (!secret) return null;
  const token = parseCookieHeader(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  return sessionUserFromPayload(await verifyPayload(token, secret));
}

export async function readSessionUserFromRequest(request: Request, secret: string | null | undefined) {
  return readSessionUser(request.headers.get("cookie"), secret);
}

export async function signOAuthPending(
  value: { nonce: string; verifier: string; returnTo: string },
  secret: string,
  now = Date.now(),
) {
  const exp = Math.floor(now / 1000) + OAUTH_MAX_AGE_SEC;
  return signPayload({ t: "oauth", ...value, exp }, secret);
}

export async function readOAuthPending(cookieHeader: string | null | undefined, secret: string | null | undefined) {
  if (!secret) return null;
  const token = parseCookieHeader(cookieHeader, OAUTH_COOKIE);
  if (!token) return null;
  const payload = await verifyPayload(token, secret);
  if (!payload || payload.t !== "oauth") return null;
  return payload;
}

export function randomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}
