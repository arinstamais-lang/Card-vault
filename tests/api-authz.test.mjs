import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-authz`);
const { default: worker } = await import(workerUrl.href);

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

function env(overrides = {}) {
  return {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
    ...overrides,
  };
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
  const response = await fetchPath(
    "/cards/carlos-prates-cav-cps-69-99-front.webp",
    {
      headers: {
        "oai-authenticated-user-id": "someone-else",
        "oai-authenticated-user-email": "other@example.com",
      },
    },
    env({ VAULT_LEGACY_OWNER_ID: "ari-owner" }),
  );
  assert.equal(response.status, 404);
});

test("public landing page still loads without sign-in", async () => {
  const response = await fetchPath("/", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /login-page/);
  assert.match(html, /Continue with ChatGPT/);
  assert.match(html, /signin-with-chatgpt/);
});
