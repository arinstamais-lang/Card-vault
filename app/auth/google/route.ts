import { env } from "cloudflare:workers";

import {
  AUTH_RESERVED_PATHS,
  googleAuthorizationUrl,
  htmlError,
  missingAuthSecrets,
  trimSetting,
} from "../../../lib/google-oauth";
import {
  OAUTH_COOKIE,
  OAUTH_MAX_AGE_SEC,
  pkceChallenge,
  randomBase64Url,
  requestIsHttps,
  safeRelativeReturnPath,
  serializeCookie,
  signOAuthPending,
} from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const missing = missingAuthSecrets(runtime);
  if (missing.length) return htmlError(503, "Google sign-in is not configured", "", missing);

  const clientId = trimSetting(runtime.GOOGLE_CLIENT_ID);
  const secret = trimSetting(runtime.SESSION_SECRET);
  const requestUrl = new URL(request.url);
  const returnTo = safeRelativeReturnPath(requestUrl.searchParams.get("return_to") || "/", AUTH_RESERVED_PATHS);
  const nonce = randomBase64Url(24);
  const verifier = randomBase64Url(32);
  const challenge = await pkceChallenge(verifier);
  const pending = await signOAuthPending({ nonce, verifier, returnTo }, secret);
  const location = googleAuthorizationUrl({
    clientId,
    origin: requestUrl.origin,
    state: nonce,
    challenge,
    nonce,
  });

  return new Response(null, {
    status: 302,
    headers: {
      location,
      "cache-control": "private, no-store",
      "set-cookie": serializeCookie(OAUTH_COOKIE, pending, {
        maxAge: OAUTH_MAX_AGE_SEC,
        secure: requestIsHttps(request),
      }),
    },
  });
}
