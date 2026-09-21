import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function exists(relativePath) {
  await access(path.join(root, relativePath));
}

test("PWA manifest is installable and icons exist", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons?.length >= 3);
  const sizes = new Set(manifest.icons.map((icon) => icon.sizes));
  assert.ok(sizes.has("192x192"));
  assert.ok(sizes.has("512x512"));
  assert.ok(manifest.icons.some((icon) => String(icon.purpose).includes("maskable")));
  for (const icon of manifest.icons) {
    await exists(path.join("public", icon.src.replace(/^\//, "")));
  }
  await exists("public/apple-touch-icon.png");
});

test("service worker has a fetch handler and never caches private APIs", async () => {
  const sw = await read("public/sw.js");
  assert.match(sw, /addEventListener\(\s*["']fetch["']/);
  assert.match(sw, /\/api\//);
  assert.match(sw, /NEVER_CACHE_PREFIXES|shouldBypass/);
  assert.match(sw, /\/cards\//);
  assert.match(sw, /offline\.html/);
  await exists("public/offline.html");
});

test("layout links the manifest, Apple icon, and service worker register", async () => {
  const layout = await read("app/layout.tsx");
  assert.match(layout, /manifest:\s*["']\/manifest\.webmanifest["']/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /viewportFit:\s*["']cover["']/);
  assert.match(layout, /PwaRegister/);
  const register = await read("app/pwa-register.tsx");
  assert.match(register, /serviceWorker\.register\(\s*["']\/sw\.js["']/);
});

test("scanner keeps rear-camera capture and a library picker for iPhone Safari", async () => {
  const scanner = await read("app/card-scanner.tsx");
  assert.match(scanner, /capture=["']environment["']/);
  assert.match(scanner, /Choose \$\{side\} from library|Choose from library/);
  assert.match(scanner, /type=["']file["']/);
  assert.match(scanner, /accept=\{SCAN_ACCEPT\}/);
  const withoutCapture = [...scanner.matchAll(/<input[\s\S]*?\/>/g)].filter((match) => !/capture=/.test(match[0]));
  assert.ok(withoutCapture.some((match) => /type=["']file["']/.test(match[0])));
  assert.doesNotMatch(scanner, /pointer-events:\s*none/);
  assert.match(scanner, /On iPhone Safari/);
  assert.match(scanner, /Preview of the card \$\{side\}/);
});

test("landing, vault, and scanner keep accessible names on key controls", async () => {
  const landing = await read("app/page.tsx");
  assert.match(landing, /Skip to sign in/);
  assert.match(landing, /Install on iPhone/);
  assert.match(landing, /Add to Home Screen/);
  assert.match(landing, /Continue with ChatGPT/);
  assert.match(landing, /aria-hidden="true"/);

  const vault = await read("app/card-vault.tsx");
  assert.match(vault, /Skip to collection/);
  assert.match(vault, /aria-label="Add asset"/);
  assert.match(vault, /aria-label="Search eBay Australia"/);
  assert.match(vault, /aria-pressed=\{showcase\}/);
  assert.match(vault, /loading="lazy"/);
  assert.match(vault, /alt=\{\`\$\{card\.name\} card front\`\}/);

  const scanner = await read("app/card-scanner.tsx");
  assert.match(scanner, /aria-label="Scan card"/);
  assert.match(scanner, /alt="Captured card front"/);
});

test("Phase 4 docs do not claim TestFlight was uploaded", async () => {
  const phase4 = await read("PHASE4.md");
  assert.match(phase4, /TestFlight/);
  assert.match(phase4, /Apple Developer/);
  assert.match(phase4, /Not done/i);
  assert.match(phase4, /Install on iPhone/);
  const prep = await read("APP_STORE_PREP.md");
  assert.match(prep, /NSCameraUsageDescription/);
  assert.match(prep, /Photos or videos/i);
  assert.match(prep, /nothing can be uploaded to TestFlight from this PR/i);
  assert.doesNotMatch(prep, /this PR uploaded a TestFlight build/i);
});
