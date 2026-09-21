import assert from "node:assert/strict";
import test from "node:test";

import { env as workerEnv } from "./cloudflare-workers-mock.mjs";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-authz`);
const { default: worker } = await import(workerUrl.href);

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

const encoder = new TextEncoder();

function env(overrides = {}) {
  return {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    ...overrides,
  };
}

async function signVaultSession(user, secret) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    t: "session",
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    fullName: user.fullName,
    iat,
    exp: iat + 3600,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsigned = `v1.${body}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned))).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function fetchPath(path, init = {}, runtime = env()) {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    runtime,
    executionContext,
  );
}

const collectionRoutes = [
  ["GET", "/api/assets"],
  ["POST", "/api/assets"],
  ["PATCH", "/api/assets"],
  ["DELETE", "/api/assets"],
  ["GET", "/api/financials"],
  ["PUT", "/api/financials"],
  ["GET", "/api/export"],
  ["DELETE", "/api/account"],
  ["GET", "/api/valuations"],
  ["POST", "/api/valuations"],
  ["GET", "/api/card-image?key=scans/abc-front.jpg"],
];

for (const [method, path] of collectionRoutes) {
  test(`unsigned ${method} ${path} returns 401`, async () => {
    const response = await fetchPath(path, { method });
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.match(String(payload.error || ""), /sign in required/i);
  });
}

test("unsigned seed catalog photos return 401", async () => {
  const card = await fetchPath("/cards/carlos-prates-cav-cps-69-99-front.webp");
  const metal = await fetchPath("/metals/james-bond-60-years-1oz-front.webp");
  assert.equal(card.status, 401);
  assert.equal(metal.status, 401);
});

test("seed catalog photos stay hidden from a different signed-in owner", async () => {
  const secret = "test-session-secret-at-least-32-chars!!";
  const token = await signVaultSession(
    { id: "someone-else", email: "other@example.com", displayName: "Other", fullName: null },
    secret,
  );
  const response = await fetchPath(
    "/cards/carlos-prates-cav-cps-69-99-front.webp",
    { headers: { cookie: `vault_session=${token}` } },
    env({ SESSION_SECRET: secret, VAULT_LEGACY_OWNER_ID: "ari-owner" }),
  );
  assert.equal(response.status, 404);
});

test("ChatGPT Sites identity headers do not authenticate on Workers", async () => {
  const response = await fetchPath("/api/assets", {
    headers: {
      "oai-authenticated-user-id": "spoof",
      "oai-authenticated-user-email": "spoof@example.com",
    },
  });
  assert.equal(response.status, 401);
});

test("public landing page still loads without sign-in", async () => {
  const response = await fetchPath("/", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /login-page/);
  assert.match(html, /Sign in with Google/);
  assert.match(html, /\/auth\/google/);
  assert.doesNotMatch(html, /Continue with ChatGPT/);
});

test("Google sign-in fails clearly when Worker secrets are missing", async () => {
  delete workerEnv.GOOGLE_CLIENT_ID;
  delete workerEnv.GOOGLE_CLIENT_SECRET;
  delete workerEnv.SESSION_SECRET;
  const response = await fetchPath("/auth/google", { headers: { accept: "text/html" } });
  assert.equal(response.status, 503);
  const html = await response.text();
  assert.match(html, /Google sign-in is not configured/);
  assert.match(html, /GOOGLE_CLIENT_ID/);
  assert.match(html, /SESSION_SECRET/);
  assert.doesNotMatch(html, /login-page/);
});

test("plain eBay search does not fake affiliate tracking when campaign IDs are missing", async () => {
  const response = await fetchPath("/go/ebay?q=Carlos+Prates+CAV-CPS&source=asset-active");
  assert.equal(response.status, 302);
  const location = response.headers.get("location") || "";
  assert.match(location, /^https:\/\/www\.ebay\.com\.au\/sch\/i\.html/);
  assert.match(location, /_nkw=Carlos(\+|%20)Prates(\+|%20)CAV-CPS/);
  assert.doesNotMatch(location, /campid=/);
  assert.doesNotMatch(location, /mkevt=/);
  assert.doesNotMatch(location, /mkcid=/);
  assert.doesNotMatch(location, /LH_Sold=/);
});

test("service worker responses advertise the root scope", async () => {
  const response = await fetchPath(
    "/sw.js",
    {},
    env({
      ASSETS: {
        fetch: async () =>
          new Response("self.addEventListener('fetch', () => {});", {
            headers: { "content-type": "text/plain" },
          }),
      },
    }),
  );
  assert.match(response.headers.get("content-type") ?? "", /javascript/i);
  assert.equal(response.headers.get("service-worker-allowed"), "/");
  assert.match(response.headers.get("cache-control") ?? "", /no-cache/i);
});

test("Google sign-in redirects to Google when Worker secrets exist", async () => {
  Object.assign(workerEnv, {
    GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "google-secret",
    SESSION_SECRET: "test-session-secret-at-least-32-chars!!",
  });
  try {
    const response = await fetchPath("/auth/google?return_to=/");
    assert.equal(response.status, 302);
    const location = response.headers.get("location") || "";
    assert.match(location, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    assert.match(location, /client_id=client\.apps\.googleusercontent\.com/);
    assert.match(location, /redirect_uri=http%3A%2F%2Flocalhost%2Fauth%2Fgoogle%2Fcallback/);
    assert.match(response.headers.get("set-cookie") || "", /vault_oauth=/);
  } finally {
    delete workerEnv.GOOGLE_CLIENT_ID;
    delete workerEnv.GOOGLE_CLIENT_SECRET;
    delete workerEnv.SESSION_SECRET;
  }
});

test("sold eBay search is marked sold and still has no tracking without campaign IDs", async () => {
  const response = await fetchPath("/go/ebay?q=CAV-CPS&kind=sold&source=asset-sold");
  assert.equal(response.status, 302);
  const location = response.headers.get("location") || "";
  assert.match(location, /LH_Sold=1/);
  assert.match(location, /LH_Complete=1/);
  assert.doesNotMatch(location, /campid=/);
  assert.doesNotMatch(location, /mkevt=/);
});
