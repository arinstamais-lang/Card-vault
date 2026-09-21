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

const fields = await vite.ssrLoadModule("/lib/card-fields.ts");
const ebay = await vite.ssrLoadModule("/lib/ebay-search.ts");
const valuation = await vite.ssrLoadModule("/lib/valuation-evidence.ts");

const prates = {
  name: "Carlos Prates",
  subtitle: "2026 Stadium Club UFC · CAV-CPS",
  description: "Chrome Autograph Variation · Turquoise Refractor",
  serial: "69/99",
  valueAud: 149,
  rangeAud: "A$135–A$165",
  marketUsd: 107,
  marketLabel: "Latest exact sale",
  marketDate: "17 Aug 2026 · ungraded · eBay",
  marketChecked: "5 Sep 2026",
  confidence: "Strong",
  confidenceNote: "One exact-parallel completed sale is indexed.",
  sourceUrl: "https://www.sportscardspro.com/example",
};

const listing = {
  name: "Leon Edwards",
  subtitle: "2026 Topps Chrome UFC · 86S-LE",
  description: "1986 Topps Signatures · Refractor autograph",
  serial: "86S-LE",
  valueAud: 28,
  rangeAud: "A$24–A$32",
  marketUsd: 19.99,
  marketLabel: "Exact-card listing",
  marketDate: "5 Sep 2026 · ungraded · eBay",
  marketChecked: "5 Sep 2026",
  confidence: "Moderate",
  confidenceNote: "Exact card is listed; a fresh completed sale is still needed.",
  sourceUrl: "https://www.sportscardspro.com/listing-example",
};

test("confirmed card fields build a precise eBay AU search phrase", () => {
  const parsed = fields.parseCardFieldsFromAsset(prates);
  const phrase = ebay.buildEbaySearchPhrase(parsed);
  assert.match(phrase, /2026/);
  assert.match(phrase, /Carlos Prates/);
  assert.match(phrase, /CAV-CPS/);
  assert.match(phrase, /Stadium Club UFC/);
  assert.match(phrase, /69\/99/);
  assert.doesNotMatch(phrase, /Trading card/i);
});

test("scanned description fields stay in the search phrase", () => {
  const parsed = fields.parseConfirmedCardFields({
    name: "Valentina Shevchenko",
    sport: "UFC / MMA",
    year: "2026",
    setName: "Topps Stadium Club Chrome UFC",
    cardNumber: "TVN-35",
    parallel: "Chrome Triumvirates",
    serial: "TVN-35",
  });
  const phrase = ebay.buildEbaySearchPhrase(parsed);
  assert.match(phrase, /Valentina Shevchenko/);
  assert.match(phrase, /2026/);
  assert.match(phrase, /TVN-35/);
  assert.match(phrase, /Stadium Club Chrome UFC/);
});

test("asking listings are never classified or labelled as sold", () => {
  assert.equal(valuation.inferEvidenceKindFromLabel("Exact-card listing"), "asking");
  assert.equal(valuation.inferEvidenceKindFromLabel("Exact-parallel listing"), "asking");
  assert.equal(valuation.inferEvidenceKindFromLabel("Comparable listing level"), "asking");
  assert.equal(valuation.evidenceBadge("asking"), "ASKING PRICE");
  assert.equal(valuation.isSoldLabel("asking"), false);
  assert.notEqual(valuation.evidenceBadge("asking"), "SOLD EVIDENCE");
});

test("hardcoded UFC notes stay stored notes / not live evidence even if the old label said sale", () => {
  const summary = valuation.valuationFromCatalogNotes(prates);
  assert.equal(summary.liveMarketValue, false);
  assert.equal(summary.estimatedFrom, "stored_note");
  assert.equal(summary.headline, "Stored notes / not live evidence");
  assert.match(summary.disclaimer, /stored notes/i);
  assert.equal(summary.evidence[0].kind, "stored_note");
  assert.equal(valuation.evidenceBadge(summary.evidence[0].kind), "STORED NOTE");
  assert.deepEqual(summary.estimatedRangeAud, { low: 135, high: 165 });
  assert.ok(summary.estimatedRangeUsd);
});

test("asking evidence cannot invent a sold range or live value", () => {
  const summary = valuation.summarizeValuation([
    {
      kind: "asking",
      match: "exact",
      condition: "raw",
      rangeAud: { low: 40, high: 55 },
      sourceUrl: "https://www.ebay.com.au/itm/asking",
      sourceLabel: "Active listing",
    },
  ]);
  assert.equal(summary.liveMarketValue, false);
  assert.equal(summary.estimatedFrom, null);
  assert.equal(summary.estimatedRangeAud, null);
  assert.deepEqual(summary.askingRangeAud, { low: 40, high: 55 });
  assert.match(summary.headline, /asking/i);
  assert.equal(valuation.isSoldLabel("asking"), false);
});

test("sold and asking evidence stay separated when both exist", () => {
  const summary = valuation.summarizeValuation([
    {
      kind: "sold",
      match: "exact",
      condition: "raw",
      rangeAud: { low: 100, high: 120 },
      sourceUrl: "https://www.ebay.com.au/itm/sold",
    },
    {
      kind: "asking",
      match: "exact",
      condition: "raw",
      rangeAud: { low: 180, high: 200 },
      sourceUrl: "https://www.ebay.com.au/itm/asking",
    },
  ]);
  assert.deepEqual(summary.estimatedRangeAud, { low: 100, high: 120 });
  assert.deepEqual(summary.askingRangeAud, { low: 180, high: 200 });
  assert.equal(summary.estimatedFrom, "sold");
  assert.equal(summary.liveMarketValue, false);
  assert.ok(!summary.sources.some((source) => source.kind === "asking" && source.label.toLowerCase().includes("sold")));
});

test("catalog listing notes are not converted into sold evidence", () => {
  const summary = valuation.valuationFromCatalogNotes(listing);
  assert.equal(summary.evidence[0].kind, "stored_note");
  assert.equal(valuation.inferEvidenceKindFromLabel(listing.marketLabel), "asking");
  assert.notEqual(summary.estimatedFrom, "sold");
});

test("missing affiliate IDs do not fake eBay tracking params", () => {
  const active = ebay.buildEbayAustraliaSearch({
    query: "Carlos Prates CAV-CPS",
    kind: "active",
    affiliate: { campaignId: "", marketplaceId: "" },
  });
  const partial = ebay.buildEbayAustraliaSearch({
    query: "Carlos Prates CAV-CPS",
    kind: "sold",
    affiliate: { campaignId: "123456", marketplaceId: "" },
  });
  const missing = ebay.buildEbayAustraliaSearch({
    query: "Carlos Prates CAV-CPS",
    kind: "active",
  });
  for (const result of [active, partial, missing]) {
    assert.equal(result.trackingEnabled, false);
    assert.equal(ebay.trackingParamsPresent(result.url), false);
    assert.doesNotMatch(result.url, /campid=/);
    assert.doesNotMatch(result.url, /mkevt=/);
    assert.doesNotMatch(result.url, /mkcid=/);
  }
});

test("affiliate params are added only when campaign and marketplace IDs exist", () => {
  const tracked = ebay.buildEbayAustraliaSearch({
    query: "Carlos Prates CAV-CPS",
    kind: "active",
    source: "asset-active",
    affiliate: { campaignId: "1234567890", marketplaceId: "705-53470-19255-0" },
  });
  assert.equal(tracked.trackingEnabled, true);
  const url = new URL(tracked.url);
  assert.equal(url.searchParams.get("campid"), "1234567890");
  assert.equal(url.searchParams.get("mkrid"), "705-53470-19255-0");
  assert.equal(url.searchParams.get("mkevt"), "1");
});

test("active and sold eBay searches are distinct URLs", () => {
  const active = ebay.buildEbayAustraliaSearch({ query: "CAV-CPS", kind: "active" });
  const sold = ebay.buildEbayAustraliaSearch({ query: "CAV-CPS", kind: "sold" });
  const unknown = ebay.buildEbayAustraliaSearch({ query: "CAV-CPS", kind: "whatever" });
  assert.equal(active.kind, "active");
  assert.equal(sold.kind, "sold");
  assert.equal(unknown.kind, "active");
  assert.equal(new URL(active.url).searchParams.get("LH_Sold"), null);
  assert.equal(new URL(sold.url).searchParams.get("LH_Sold"), "1");
  assert.equal(new URL(sold.url).searchParams.get("LH_Complete"), "1");
  assert.match(active.url, /ebay\.com\.au/);
  assert.match(sold.url, /ebay\.com\.au/);
});
