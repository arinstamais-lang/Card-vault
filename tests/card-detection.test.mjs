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

const detection = await vite.ssrLoadModule("/lib/card-detection.ts");

test("noisy OCR does not invent an athlete name", () => {
  const result = detection.detectCardDetails(
    "TOPPS CHROME UFC\nROOKIE\nREFRACTOR\n2026",
    "TRADING CARD\nTHE COMPANY\nRESERVED",
  );
  assert.equal(result.name, "");
  assert.equal(result.year, "2026");
  assert.equal(result.sport, "UFC / MMA");
});

test("known names can be matched without inventing extra fields", () => {
  const result = detection.detectCardDetails(
    "CARLOS PRATES\nCAV-CPS\n69/99",
    "2026 STADIUM CLUB CHROME UFC",
    ["Carlos Prates"],
  );
  assert.equal(result.name, "Carlos Prates");
  assert.equal(result.cardNumber, "CAV-CPS");
  assert.equal(result.serial, "69/99");
  assert.equal(result.year, "2026");
});

test("empty detection copy is honest and does not claim a match", () => {
  const empty = detection.detectionDraftCopy({
    name: "",
    sport: "",
    year: "",
    setName: "",
    cardNumber: "",
    parallel: "",
    serial: "",
    confidence: 0,
  });
  assert.equal(empty.level, "empty");
  assert.match(empty.title, /nothing reliable/i);
  assert.equal(empty.confidenceLabel, "");
  assert.match(empty.body, /do not invent/i);
});

test("low OCR confidence is labelled as a draft, not identity", () => {
  const low = detection.detectionDraftCopy({
    name: "Carlos Prates",
    sport: "",
    year: "",
    setName: "",
    cardNumber: "",
    parallel: "",
    serial: "",
    confidence: 40,
  });
  assert.equal(low.level, "low");
  assert.match(low.title, /confirm before saving/i);
  assert.match(low.confidenceLabel, /not identity/i);
});
