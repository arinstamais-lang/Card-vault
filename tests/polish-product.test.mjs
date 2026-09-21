import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("CUTOVER.md tells Ari to use workers.dev and what the bot owns", async () => {
  const docs = await read("CUTOVER.md");
  assert.match(docs, /card-vault\.ariscardvault\.workers\.dev/);
  assert.match(docs, /\/auth\/github\/callback/);
  assert.match(docs, /retire ChatGPT Sites/i);
  assert.match(docs, /dedicated bot owns/i);
  assert.match(docs, /does \*\*not\*\* own/i);
  assert.match(docs, /wrangler deploy/);
  assert.doesNotMatch(docs, /Sign in with Google/);
});

test("product docs and UI copy are GitHub OAuth, not Google auth", async () => {
  const files = ["README.md", "REHOST.md", "BOT_HANDOVER.md", "app/page.tsx", "app/privacy/page.tsx", "APP_STORE_PREP.md"];
  for (const file of files) {
    const text = await read(file);
    assert.doesNotMatch(text, /Sign in with Google/);
    assert.doesNotMatch(text, /GOOGLE_CLIENT_/);
    assert.match(text, /GitHub/);
  }
  const readme = await read("README.md");
  assert.match(readme, /card-vault\.ariscardvault\.workers\.dev/);
  assert.match(readme, /workers_dev = true/);
  assert.match(readme, /a85197a6-e0ba-465f-b4f6-b17d8939a5d8/);
  const handover = await read("BOT_HANDOVER.md");
  assert.match(handover, /card-vault\.ariscardvault\.workers\.dev/);
  assert.doesNotMatch(handover, /chatgpt\.site/);
});

test("empty vault first-run has a scan CTA and no demo price copy", async () => {
  const vault = await read("app/card-vault.tsx");
  assert.match(vault, /EmptyVaultFirstRun/);
  assert.match(vault, /Your vault is empty/);
  assert.match(vault, /no demo prices/);
  assert.match(vault, /Scan your first card/);
  assert.match(vault, /No collection yet/);
  assert.match(vault, /Download a private export\?/);
  assert.match(vault, /Remove from vault/);
  assert.match(vault, /Asking stays separate from sold/);
  assert.doesNotMatch(vault, /window\.confirm/);
});

test("worker applies security headers without trusting identity headers", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /x-content-type-options/);
  assert.match(worker, /x-frame-options/);
  assert.match(worker, /strict-transport-security/);
  assert.match(worker, /permissions-policy/);
  assert.match(worker, /camera=\(self\)/);
  assert.doesNotMatch(worker, /camera=\(\)/);
  const auth = await read("app/auth.ts");
  assert.match(auth, /Never trust spoofable headers/);
  assert.match(auth, /oai-authenticated-user/);
});

test("confirm draft light-theme inputs use solid foreground, not near-white", async () => {
  const css = await read("app/globals.css");
  // confirm draft light-theme input contrast
  assert.match(css, /:root\[data-theme="light"\] \.field input/);
  assert.match(css, /color:\s*#162033/);
  assert.match(css, /-webkit-text-fill-color:\s*#162033/);
  assert.match(css, /\.scanner-dialog \.scanner-footer/);
  assert.match(css, /position:\s*sticky/);
});
