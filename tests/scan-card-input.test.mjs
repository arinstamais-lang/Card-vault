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

const scan = await vite.ssrLoadModule("/lib/scan-card-input.ts");

test("blank year is allowed for confirm-and-add", () => {
  assert.deepEqual(scan.normalizeYear(""), { ok: true, year: "" });
  assert.deepEqual(scan.normalizeYear("  "), { ok: true, year: "" });
  assert.deepEqual(scan.normalizeYear("2024"), { ok: true, year: "2024" });
  assert.equal(scan.normalizeYear("88").ok, false);
  assert.equal(scan.normalizeYear("UFC / MMA").ok, false);
});

test("Topuria-style draft fields normalize without inventing year", () => {
  const name = scan.normalizeScanName("Ilia Topuria");
  assert.equal(name.ok, true);
  assert.equal(name.name, "Ilia Topuria");
  assert.deepEqual(scan.normalizeYear(""), { ok: true, year: "" });
  assert.deepEqual(scan.normalizeManualValueAud(""), { ok: true, manualValueAud: null });
});

test("image content types from iPhone still accept", () => {
  assert.equal(scan.normalizeImageContentType(""), "image/jpeg");
  assert.equal(scan.normalizeImageContentType("image/jpg"), "image/jpeg");
  assert.equal(scan.normalizeImageContentType("image/jpeg; codecs=hevc"), "image/jpeg");
  assert.equal(scan.isAllowedScanImageType("image/heic"), true);
  assert.equal(scan.isAllowedScanImageType(""), true);
  assert.equal(scan.isAllowedScanImageType("application/octet-stream"), true);
});

test("scanner confirm form disables native constraint validation", async () => {
  const source = await vite.ssrLoadModule("/app/card-scanner.tsx").then(async () => {
    const fs = await import("node:fs/promises");
    return fs.readFile(new URL("../app/card-scanner.tsx", import.meta.url), "utf8");
  });
  assert.match(source, /noValidate/);
  assert.match(source, /Year can be blank or a 4-digit year/);
  assert.doesNotMatch(source, /id="scan-value"[^>]*type="number"/);
});
