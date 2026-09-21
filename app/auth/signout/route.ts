import { AUTH_RESERVED_PATHS } from "../../../lib/github-oauth";
import { clearCookie, OAUTH_COOKIE, requestIsHttps, safeRelativeReturnPath, SESSION_COOKIE } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeRelativeReturnPath(requestUrl.searchParams.get("return_to") || "/", AUTH_RESERVED_PATHS);
  const secure = requestIsHttps(request);
  const headers = new Headers({
    location: returnTo,
    "cache-control": "private, no-store",
  });
  headers.append("set-cookie", clearCookie(SESSION_COOKIE, secure));
  headers.append("set-cookie", clearCookie(OAUTH_COOKIE, secure));
  return new Response(null, { status: 302, headers });
}
