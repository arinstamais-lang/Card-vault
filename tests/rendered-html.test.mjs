import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

test("renders the signed-out GitHub landing page", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /login-page/);
  assert.match(html, /Sign in with GitHub/);
  assert.match(html, /Install on iPhone/);
  assert.match(html, /Add to Home Screen/);
  assert.match(html, /Skip to sign in/);
  assert.doesNotMatch(html, /Continue with ChatGPT/);
  assert.doesNotMatch(html, /Sign in with Google/);
  assert.match(response.headers.get("x-content-type-options") ?? "", /nosniff/i);
  assert.match(response.headers.get("referrer-policy") ?? "", /strict-origin-when-cross-origin/i);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});
