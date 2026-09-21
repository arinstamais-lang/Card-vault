export const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";
export const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";
export const GITHUB_SCOPES = "read:user user:email";
export const GITHUB_USER_AGENT = "aris-card-vault";

export const AUTH_SIGN_IN_PATH = "/auth/github";
export const AUTH_CALLBACK_PATH = "/auth/github/callback";
export const AUTH_SIGN_OUT_PATH = "/auth/signout";

export const AUTH_RESERVED_PATHS = [AUTH_SIGN_IN_PATH, AUTH_CALLBACK_PATH, AUTH_SIGN_OUT_PATH] as const;

export const AUTH_SECRET_NAMES = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SESSION_SECRET"] as const;

export type AuthRuntime = {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
};

export type GitHubProfile = {
  id: string;
  login: string;
  email: string;
  name: string | null;
};

export function trimSetting(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function missingAuthSecrets(runtime: AuthRuntime) {
  return AUTH_SECRET_NAMES.filter((name) => !trimSetting(runtime[name]));
}

export function githubCallbackUrl(origin: string) {
  return `${origin}${AUTH_CALLBACK_PATH}`;
}

export function githubAuthorizationUrl(options: { clientId: string; origin: string; state: string }) {
  const url = new URL(GITHUB_AUTH_URL);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", githubCallbackUrl(options.origin));
  url.searchParams.set("scope", GITHUB_SCOPES);
  url.searchParams.set("state", options.state);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

export function authConfigErrorPage(missing: readonly string[]) {
  const list = missing.map((name) => `<code>${name}</code>`).join(", ");
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GitHub sign-in is not configured</title>
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
    <h1>GitHub sign-in is not configured</h1>
    <p>This Cloudflare Worker is missing ${list}. No signed-in vault was created.</p>
    <p>Set those secrets on the Worker, then try <strong>Sign in with GitHub</strong> again. See <code>REHOST.md</code>.</p>
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
    <p><a href="/auth/github">Try GitHub sign-in again</a> · <a href="/">Back to Collector Vault</a></p>
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

function githubApiHeaders(accessToken?: string) {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": GITHUB_USER_AGENT,
    "x-github-api-version": "2022-11-28",
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function exchangeGitHubCode(options: {
  code: string;
  origin: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": GITHUB_USER_AGENT,
    },
    body: JSON.stringify({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      code: options.code,
      redirect_uri: githubCallbackUrl(options.origin),
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !payload?.access_token) {
    return {
      ok: false as const,
      error: payload?.error_description || payload?.error || `GitHub token exchange failed (${response.status})`,
    };
  }
  return { ok: true as const, accessToken: payload.access_token };
}

export function pickGitHubEmail(
  userEmail: string | null | undefined,
  emails: Array<{ email?: string; primary?: boolean; verified?: boolean }>,
  fallback: string,
) {
  const direct = String(userEmail || "").trim();
  if (direct) return direct;
  const verifiedPrimary = emails.find((row) => row.primary && row.verified && row.email);
  const verified = emails.find((row) => row.verified && row.email);
  const primary = emails.find((row) => row.primary && row.email);
  return String(verifiedPrimary?.email || verified?.email || primary?.email || fallback).trim();
}

export async function fetchGitHubProfile(accessToken: string, fetchImpl: typeof fetch = fetch) {
  const userResponse = await fetchImpl(GITHUB_USER_URL, { headers: githubApiHeaders(accessToken) });
  const user = (await userResponse.json().catch(() => null)) as {
    id?: number | string;
    login?: string;
    email?: string | null;
    name?: string | null;
  } | null;
  if (!userResponse.ok || user?.id == null || !user.login) {
    return { ok: false as const, error: "GitHub did not return a user profile." };
  }

  const emailsResponse = await fetchImpl(GITHUB_EMAILS_URL, { headers: githubApiHeaders(accessToken) });
  const emails = emailsResponse.ok
    ? ((await emailsResponse.json().catch(() => [])) as Array<{ email?: string; primary?: boolean; verified?: boolean }>)
    : [];
  const id = String(user.id);
  const login = String(user.login).trim();
  const email = pickGitHubEmail(user.email, Array.isArray(emails) ? emails : [], `${id}+${login}@users.noreply.github.com`);
  if (!email) return { ok: false as const, error: "GitHub did not return an email address." };
  const name = String(user.name || "").trim();
  return {
    ok: true as const,
    profile: {
      id,
      login,
      email,
      name: name || null,
    } satisfies GitHubProfile,
  };
}
