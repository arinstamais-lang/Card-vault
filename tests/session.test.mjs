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
const oauth = await vite.ssrLoadModule("/lib/google-oauth.ts");

const secret = "test-session-secret-at-least-32-chars!!";
const user = {
  id: "google:123",
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

test("Google owner ids are namespaced", () => {
  assert.equal(session.googleOwnerId("abc"), "google:abc");
});

test("missing Google secrets are listed without inventing credentials", () => {
  assert.deepEqual(oauth.missingAuthSecrets({}), [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "SESSION_SECRET",
  ]);
  assert.deepEqual(
    oauth.missingAuthSecrets({
      GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "secret",
      SESSION_SECRET: "session",
    }),
    [],
  );
});

test("authorization URL is OpenID with PKCE and the Workers callback", async () => {
  const verifier = session.randomBase64Url(32);
  const challenge = await session.pkceChallenge(verifier);
  const url = new URL(
    oauth.googleAuthorizationUrl({
      clientId: "client.apps.googleusercontent.com",
      origin: "https://card-vault.example.workers.dev",
      state: "nonce",
      challenge,
      nonce: "nonce",
    }),
  );
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "client.apps.googleusercontent.com");
  assert.equal(url.searchParams.get("redirect_uri"), "https://card-vault.example.workers.dev/auth/google/callback");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), challenge);
});
