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

function detectionFixture(overrides = {}) {
  return {
    name: "Carlos Prates",
    sport: "UFC / MMA",
    year: "",
    setName: "",
    cardNumber: "",
    parallel: "",
    serial: "",
    confidence: 80,
    ...overrides,
  };
}

test("auto-save threshold is OCR 80 with name and sport required", () => {
  assert.equal(detection.AUTO_SAVE_MIN_CONFIDENCE, 80);
});

test("high confidence name and sport can skip confirm", () => {
  assert.equal(detection.shouldAutoSaveDetection(detectionFixture({
    confidence: 90,
    setName: "Topps Chrome UFC",
    cardNumber: "CAV-CPS",
  })), true);
});

test("missing sport stays on confirm even at high confidence", () => {
  assert.equal(detection.shouldAutoSaveDetection(detectionFixture({ sport: "", confidence: 90 })), false);
  assert.equal(detection.shouldAutoSaveDetection(detectionFixture({ sport: "   ", confidence: 90 })), false);
});

test("confidence 79 stays on confirm", () => {
  assert.equal(detection.shouldAutoSaveDetection(detectionFixture({ confidence: 79 })), false);
});

test("blank year still auto-saves when name, sport, and confidence clear the gate", () => {
  const draft = detectionFixture({ year: "", confidence: 80 });
  assert.equal(draft.year, "");
  assert.equal(detection.shouldAutoSaveDetection(draft), true);
});

test("empty name stays on confirm", () => {
  assert.equal(detection.shouldAutoSaveDetection(detectionFixture({ name: "", confidence: 90 })), false);
  assert.equal(detection.shouldAutoSaveDetection(detectionFixture({ name: "   ", confidence: 90 })), false);
});

test("name and sport alone stay under 80 and do not auto-save", () => {
  const result = detection.detectCardDetails("CARLOS PRATES\nUFC", "");
  assert.equal(result.name, "Carlos Prates");
  assert.equal(result.sport, "UFC / MMA");
  assert.equal(result.year, "");
  assert.ok(result.confidence < detection.AUTO_SAVE_MIN_CONFIDENCE);
  assert.equal(detection.shouldAutoSaveDetection(result), false);
});

test("a solid read with a blank year auto-saves without inventing a year", () => {
  const result = detection.detectCardDetails(
    "CARLOS PRATES\nUFC\nTOPPS CHROME\nCAV-CPS\n69/99\nREFRACTOR",
    "",
  );
  assert.equal(result.name, "Carlos Prates");
  assert.equal(result.sport, "UFC / MMA");
  assert.equal(result.year, "");
  assert.ok(result.confidence >= detection.AUTO_SAVE_MIN_CONFIDENCE);
  assert.equal(detection.shouldAutoSaveDetection(result), true);
});
