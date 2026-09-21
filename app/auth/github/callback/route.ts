import { env } from "cloudflare:workers";

import {
  exchangeGitHubCode,
  fetchGitHubProfile,
  htmlError,
  missingAuthSecrets,
  trimSetting,
} from "../../../../lib/github-oauth";
import {
  clearCookie,
  githubOwnerId,
  OAUTH_COOKIE,
  readOAuthPending,
  requestIsHttps,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signSession,
} from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const missing = missingAuthSecrets(runtime);
  if (missing.length) return htmlError(503, "GitHub sign-in is not configured", "", missing);

  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("error")) {
    return htmlError(400, "GitHub sign-in was cancelled", "No vault session was created.");
  }

  const code = requestUrl.searchParams.get("code") || "";
  const state = requestUrl.searchParams.get("state") || "";
  const secret = trimSetting(runtime.SESSION_SECRET);
  const pending = await readOAuthPending(request.headers.get("cookie"), secret);
  const secure = requestIsHttps(request);
  const clearOauth = clearCookie(OAUTH_COOKIE, secure);

  if (!code || !state || !pending || pending.nonce !== state) {
    return htmlError(
      400,
      "GitHub sign-in could not be completed",
      "The sign-in request was missing, expired, or did not match this browser. Try again from the landing page.",
    );
  }

  const token = await exchangeGitHubCode({
    code,
    origin: requestUrl.origin,
    clientId: trimSetting(runtime.GITHUB_CLIENT_ID),
    clientSecret: trimSetting(runtime.GITHUB_CLIENT_SECRET),
  });
  if (!token.ok) {
    return htmlError(502, "GitHub sign-in failed", "The authorization code could not be exchanged. Try again.");
  }

  const profile = await fetchGitHubProfile(token.accessToken);
  if (!profile.ok) {
    return htmlError(403, "GitHub sign-in failed", profile.error);
  }

  const session = await signSession(
    {
      id: githubOwnerId(profile.profile.id),
      email: profile.profile.email,
      displayName: profile.profile.name || profile.profile.login,
      fullName: profile.profile.name,
    },
    secret,
  );

  const headers = new Headers({
    location: pending.returnTo || "/",
    "cache-control": "private, no-store",
  });
  headers.append(
    "set-cookie",
    serializeCookie(SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE_SEC, secure }),
  );
  headers.append("set-cookie", clearOauth);
  return new Response(null, { status: 302, headers });
}
