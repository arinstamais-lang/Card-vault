import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("wrangler.toml names the Worker and binds D1 plus existing R2", async () => {
  const toml = await readFile(path.join(root, "wrangler.toml"), "utf8");
  assert.match(toml, /^name\s*=\s*"card-vault"/m);
  assert.match(toml, /account_id\s*=\s*"f82810c8a9f4145c732dfbc751ce5976"/);
  assert.match(toml, /binding\s*=\s*"DB"/);
  assert.match(toml, /database_name\s*=\s*"card-vault"/);
  assert.match(toml, /database_id\s*=\s*"a85197a6-e0ba-465f-b4f6-b17d8939a5d8"/);
  assert.doesNotMatch(toml, /00000000-0000-4000-8000-000000000000/);
  assert.match(toml, /binding\s*=\s*"BUCKET"/);
  assert.match(toml, /bucket_name\s*=\s*"card-vault"/);
  assert.doesNotMatch(toml, /GOOGLE_CLIENT_SECRET\s*=/);
  assert.doesNotMatch(toml, /GITHUB_CLIENT_SECRET\s*=\s*"[^"]+"/);
  assert.doesNotMatch(toml, /SESSION_SECRET\s*=\s*"[^"]+"/);
  assert.doesNotMatch(toml, /api[_-]?token/i);
});

test("REHOST.md documents deploy, secrets, drizzle 0001–0005, and Sites cutover", async () => {
  const docs = await readFile(path.join(root, "REHOST.md"), "utf8");
  assert.match(docs, /wrangler deploy/);
  assert.match(docs, /GITHUB_CLIENT_ID/);
  assert.match(docs, /GITHUB_CLIENT_SECRET/);
  assert.match(docs, /SESSION_SECRET/);
  assert.match(docs, /0001_lumpy_moira_mactaggert/);
  assert.match(docs, /0005_phase3_valuation_history/);
  assert.match(docs, /Sites stays live/);
  assert.match(docs, /card-vault\.ariscardvault\.workers\.dev/);
  assert.match(docs, /\/auth\/github\/callback/);
  assert.match(docs, /R2 bucket `card-vault` exist/);
  assert.doesNotMatch(docs, /GOOGLE_CLIENT_/);
  assert.doesNotMatch(docs, /Enable R2 once in the Cloudflare dashboard/);
  assert.match(docs, /does not claim a production Worker is serving users/i);
  assert.doesNotMatch(docs, /production is live/i);
});

test("Sites vite plugin is gated off the default Workers build", async () => {
  const vite = await readFile(path.join(root, "vite.config.ts"), "utf8");
  assert.match(vite, /SITES_BUILD/);
  assert.doesNotMatch(vite, /from "\.\/\.openai\/hosting\.json"/);
});
