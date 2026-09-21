import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const session = await vite.ssrLoadModule("/lib/session.ts");
const oauth = await vite.ssrLoadModule("/lib/github-oauth.ts");

const secret = "test-session-secret-at-least-32-chars!!";
const user = {
  id: "github:123",
  email: "ari@example.com",
  displayName: "Ari",
  fullName: "Ari Example",
};

test("session tokens round-trip and reject a bad HMAC", async () => {
  const token = await session.signSession(user, secret);
  const payload = await session.verifyPayload(token, secret);
  assert.equal(payload.t, "session");
  assert.equal(payload.id, user.id);
  const restored = await session.readSessionUser(`${session.SESSION_COOKIE}=${token}`, secret);
  assert.equal(restored.email, user.email);

  const tampered = `${token.slice(0, -2)}aa`;
  assert.equal(await session.verifyPayload(tampered, secret), null);
  assert.equal(await session.readSessionUser(`${session.SESSION_COOKIE}=${token}`, "other-secret"), null);
});

test("expired and empty secrets never mint a user", async () => {
  assert.equal(await session.readSessionUser("vault_session=x", ""), null);
  const expired = await session.signPayload(
    {
      t: "session",
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      fullName: user.fullName,
      iat: 1,
      exp: 2,
    },
    secret,
  );
  assert.equal(await session.verifyPayload(expired, secret), null);
});

test("GitHub owner ids are namespaced", () => {
  assert.equal(session.githubOwnerId("123"), "github:123");
  assert.equal(session.githubOwnerId(123), "github:123");
});

test("missing GitHub secrets are listed without inventing credentials", () => {
  assert.deepEqual(oauth.missingAuthSecrets({}), [
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "SESSION_SECRET",
  ]);
  assert.deepEqual(
    oauth.missingAuthSecrets({
      GITHUB_CLIENT_ID: "Iv1.example",
      GITHUB_CLIENT_SECRET: "secret",
      SESSION_SECRET: "session",
    }),
    [],
  );
});

test("authorization URL uses GitHub OAuth and the Workers callback", () => {
  const url = new URL(
    oauth.githubAuthorizationUrl({
      clientId: "Iv1.example",
      origin: "https://card-vault.ariscardvault.workers.dev",
      state: "nonce",
    }),
  );
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/login/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "Iv1.example");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://card-vault.ariscardvault.workers.dev/auth/github/callback",
  );
  assert.equal(url.searchParams.get("scope"), "read:user user:email");
  assert.equal(url.searchParams.get("state"), "nonce");
});

test("GitHub email picker prefers verified primary then noreply fallback", () => {
  assert.equal(oauth.pickGitHubEmail("public@example.com", [], "1+ari@users.noreply.github.com"), "public@example.com");
  assert.equal(
    oauth.pickGitHubEmail(null, [
      { email: "old@example.com", primary: false, verified: true },
      { email: "main@example.com", primary: true, verified: true },
    ], "1+ari@users.noreply.github.com"),
    "main@example.com",
  );
  assert.equal(oauth.pickGitHubEmail("", [], "1+ari@users.noreply.github.com"), "1+ari@users.noreply.github.com");
});

test("session cookies are Secure on workers.dev and never trust forwarded proto", () => {
  const local = new Request("http://localhost/auth/github");
  const spoofedLocal = new Request("http://localhost/auth/github", { headers: { "x-forwarded-proto": "https" } });
  const workers = new Request("https://card-vault.ariscardvault.workers.dev/auth/github");
  assert.equal(session.cookieShouldBeSecure(local), false);
  assert.equal(session.cookieShouldBeSecure(spoofedLocal), false);
  assert.equal(session.cookieShouldBeSecure(workers), true);
  assert.equal(session.requestIsHttps(spoofedLocal), false);
  assert.match(
    session.serializeCookie("vault_session", "token", { maxAge: 60, secure: session.cookieShouldBeSecure(workers) }),
    /Secure/,
  );
  assert.doesNotMatch(
    session.serializeCookie("vault_session", "token", { maxAge: 60, secure: session.cookieShouldBeSecure(local) }),
    /Secure/,
  );
});
