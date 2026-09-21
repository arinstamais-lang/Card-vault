export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_SCOPES = "openid email profile";

export const AUTH_SIGN_IN_PATH = "/auth/google";
export const AUTH_CALLBACK_PATH = "/auth/google/callback";
export const AUTH_SIGN_OUT_PATH = "/auth/signout";

export const AUTH_RESERVED_PATHS = [AUTH_SIGN_IN_PATH, AUTH_CALLBACK_PATH, AUTH_SIGN_OUT_PATH] as const;

export const AUTH_SECRET_NAMES = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET"] as const;

export type AuthRuntime = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export function trimSetting(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function missingAuthSecrets(runtime: AuthRuntime) {
  return AUTH_SECRET_NAMES.filter((name) => !trimSetting(runtime[name]));
}

export function googleCallbackUrl(origin: string) {
  return `${origin}${AUTH_CALLBACK_PATH}`;
}

export function googleAuthorizationUrl(options: {
  clientId: string;
  origin: string;
  state: string;
  challenge: string;
  nonce: string;
}) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", googleCallbackUrl(options.origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("state", options.state);
  url.searchParams.set("nonce", options.nonce);
  url.searchParams.set("code_challenge", options.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  return url.toString();
}

export function authConfigErrorPage(missing: readonly string[]) {
  const list = missing.map((name) => `<code>${name}</code>`).join(", ");
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Google sign-in is not configured</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", Helvetica, Arial, sans-serif; background: #f4f7fb; color: #152138; }
    main { max-width: 40rem; margin: 12vh auto; padding: 0 1.25rem; }
    h1 { font-size: 1.7rem; letter-spacing: -0.03em; }
    p, li { line-height: 1.55; color: #4d5b70; }
    code { font-size: 0.92em; }
    a { color: #0a6e61; }
  </style>
</head>
<body>
  <main class="auth-config-error">
    <h1>Google sign-in is not configured</h1>
    <p>This Cloudflare Worker is missing ${list}. No signed-in vault was created.</p>
    <p>Set those secrets on the Worker, then try <strong>Sign in with Google</strong> again. See <code>REHOST.md</code>.</p>
    <p><a href="/">Back to Collector Vault</a></p>
  </main>
</body>
</html>`;
}

export function authFlowErrorPage(title: string, message: string) {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", Helvetica, Arial, sans-serif; background: #f4f7fb; color: #152138; }
    main { max-width: 40rem; margin: 12vh auto; padding: 0 1.25rem; }
    h1 { font-size: 1.7rem; letter-spacing: -0.03em; }
    p { line-height: 1.55; color: #4d5b70; }
    a { color: #0a6e61; }
  </style>
</head>
<body>
  <main class="auth-flow-error">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="/auth/google">Try Google sign-in again</a> · <a href="/">Back to Collector Vault</a></p>
  </main>
</body>
</html>`;
}

export function htmlError(status: number, title: string, message: string, missing?: readonly string[]) {
  const body = missing?.length ? authConfigErrorPage(missing) : authFlowErrorPage(title, message);
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

export async function exchangeGoogleCode(options: {
  code: string;
  origin: string;
  clientId: string;
  clientSecret: string;
  verifier: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: googleCallbackUrl(options.origin),
      grant_type: "authorization_code",
      code_verifier: options.verifier,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!response.ok || !payload?.access_token) {
    return { ok: false as const, error: payload?.error || `Google token exchange failed (${response.status})` };
  }
  return { ok: true as const, accessToken: payload.access_token };
}

export async function fetchGoogleProfile(accessToken: string, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => null)) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
  } | null;
  if (!response.ok || !payload?.sub) {
    return { ok: false as const, error: "Google did not return a user profile." };
  }
  const email = String(payload.email || "").trim();
  if (!email) return { ok: false as const, error: "Google did not return an email address." };
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (!emailVerified) return { ok: false as const, error: "Google email is not verified." };
  const name = String(payload.name || "").trim();
  return {
    ok: true as const,
    profile: {
      sub: payload.sub,
      email,
      emailVerified,
      name: name || null,
    } satisfies GoogleProfile,
  };
}
