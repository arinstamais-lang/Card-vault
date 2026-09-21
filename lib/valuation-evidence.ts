export type EvidenceKind = "sold" | "asking" | "stored_note";
export type MatchKind = "exact" | "comparable" | "unknown";
export type ConditionKind = "raw" | "graded" | "unknown";
export type ConfidenceLevel = "none" | "low" | "moderate" | "high";

export type MoneyRange = {
  low: number;
  high: number;
};

export type ValuationEvidence = {
  kind: EvidenceKind;
  match: MatchKind;
  condition: ConditionKind;
  confidence?: ConfidenceLevel;
  amountAud?: number | null;
  amountUsd?: number | null;
  rangeAud?: MoneyRange | null;
  rangeUsd?: MoneyRange | null;
  checkedAt?: string | null;
  sourceUrl?: string;
  sourceLabel?: string;
  note?: string;
};

export type CardValuation = {
  estimatedRangeAud: MoneyRange | null;
  estimatedRangeUsd: MoneyRange | null;
  askingRangeAud: MoneyRange | null;
  askingRangeUsd: MoneyRange | null;
  estimatedFrom: Exclude<EvidenceKind, "asking"> | null;
  checkedAt: string | null;
  sources: Array<{ url: string; label: string; kind: EvidenceKind }>;
  match: MatchKind;
  condition: ConditionKind;
  confidence: ConfidenceLevel;
  liveMarketValue: false;
  headline: string;
  disclaimer: string;
  evidence: ValuationEvidence[];
};

export type CatalogPriceNotes = {
  name?: string;
  serial?: string;
  valueAud?: number;
  rangeAud?: string;
  marketUsd?: number;
  marketLabel?: string;
  marketDate?: string;
  marketChecked?: string;
  confidence?: "Strong" | "Moderate" | "Early market" | string;
  confidenceNote?: string;
  sourceUrl?: string;
};

const ASKING_HINT = /\b(list(ing|ed)?|asking|for sale|bin|buy it now|current market)\b/i;
const SOLD_HINT = /\b(sold|completed sale|sold comp|sale price)\b/i;
const EXACT_HINT = /\bexact\b/i;
const COMPARABLE_HINT = /\b(comparable|adjacent|similar|estimate)\b/i;
const RAW_HINT = /\b(ungraded|raw)\b/i;
const GRADED_HINT = /\b(psa|bgs|sgc|cgc|hga|csg|graded)\b/i;

export function parseMoneyAmount(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

export function parseMoneyRange(value: string | null | undefined): MoneyRange | null {
  if (!value) return null;
  const parts = String(value).split(/\s*[–—-]\s*/).map((part) => parseMoneyAmount(part));
  const amounts = parts.filter((part): part is number => part !== null);
  if (amounts.length === 0) return null;
  if (amounts.length === 1) return { low: amounts[0], high: amounts[0] };
  return { low: Math.min(amounts[0], amounts[1]), high: Math.max(amounts[0], amounts[1]) };
}

export function formatMoneyRange(range: MoneyRange | null, currency: "AUD" | "USD") {
  if (!range) return "";
  const prefix = currency === "AUD" ? "A$" : "US$";
  const format = (amount: number) => {
    const rounded = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return `${prefix}${rounded}`;
  };
  return range.low === range.high ? format(range.low) : `${format(range.low)}–${format(range.high)}`;
}

export function inferEvidenceKindFromLabel(label: string): EvidenceKind {
  if (ASKING_HINT.test(label)) return "asking";
  if (SOLD_HINT.test(label) && !/not\s+sold|no indexed sale/i.test(label)) return "sold";
  return "stored_note";
}

export function inferMatchKind(label: string): MatchKind {
  if (EXACT_HINT.test(label)) return "exact";
  if (COMPARABLE_HINT.test(label)) return "comparable";
  return "unknown";
}

export function inferConditionKind(text: string): ConditionKind {
  if (GRADED_HINT.test(text)) return "graded";
  if (RAW_HINT.test(text)) return "raw";
  return "unknown";
}

export function evidenceBadge(kind: EvidenceKind) {
  if (kind === "sold") return "SOLD EVIDENCE";
  if (kind === "asking") return "ASKING PRICE";
  return "STORED NOTE";
}

export function isSoldLabel(kind: EvidenceKind) {
  return kind === "sold";
}

export function mapCatalogConfidence(value: string | undefined): ConfidenceLevel {
  const normalized = (value || "").toLowerCase();
  if (normalized === "strong") return "high";
  if (normalized === "moderate") return "moderate";
  if (normalized.includes("early")) return "low";
  return "none";
}

export function confidenceLabel(level: ConfidenceLevel) {
  if (level === "high") return "High";
  if (level === "moderate") return "Moderate";
  if (level === "low") return "Low";
  return "None";
}

function rangeFromEvidence(items: ValuationEvidence[], currency: "AUD" | "USD"): MoneyRange | null {
  const amounts: number[] = [];
  for (const item of items) {
    const range = currency === "AUD" ? item.rangeAud : item.rangeUsd;
    const amount = currency === "AUD" ? item.amountAud : item.amountUsd;
    if (range) {
      amounts.push(range.low, range.high);
    } else if (typeof amount === "number" && Number.isFinite(amount)) {
      amounts.push(amount);
    }
  }
  if (amounts.length === 0) return null;
  return { low: Math.min(...amounts), high: Math.max(...amounts) };
}

function latestDate(items: ValuationEvidence[]) {
  const dates = items.map((item) => item.checkedAt).filter((value): value is string => Boolean(value));
  return dates.sort().at(-1) || null;
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { none: 0, low: 1, moderate: 2, high: 3 };

function highestConfidence(items: ValuationEvidence[], fallback: ConfidenceLevel): ConfidenceLevel {
  let best = fallback;
  for (const item of items) {
    const level = item.confidence || fallback;
    if (CONFIDENCE_RANK[level] > CONFIDENCE_RANK[best]) best = level;
  }
  return best;
}

function pickMeta(items: ValuationEvidence[]): { match: MatchKind; condition: ConditionKind; confidence: ConfidenceLevel } {
  if (items.some((item) => item.match === "exact")) {
    const exact = items.find((item) => item.match === "exact") || items[0];
    const fallback: ConfidenceLevel = items.some((item) => item.kind === "sold") ? "high" : "moderate";
    return {
      match: "exact",
      condition: exact.condition,
      confidence: highestConfidence(items, fallback),
    };
  }
  if (items.some((item) => item.match === "comparable")) {
    const comparable = items.find((item) => item.match === "comparable") || items[0];
    return {
      match: "comparable",
      condition: comparable.condition,
      confidence: highestConfidence(items, "low"),
    };
  }
  if (items[0]) {
    return {
      match: items[0].match,
      condition: items[0].condition,
      confidence: highestConfidence(items, "low"),
    };
  }
  return { match: "unknown", condition: "unknown", confidence: "none" };
}

export function catalogNotesAsEvidence(notes: CatalogPriceNotes): ValuationEvidence {
  const blob = `${notes.marketLabel || ""} ${notes.marketDate || ""} ${notes.confidenceNote || ""} ${notes.serial || ""}`;
  return {
    kind: "stored_note",
    match: inferMatchKind(notes.marketLabel || ""),
    condition: inferConditionKind(blob),
    amountAud: notes.valueAud ?? null,
    amountUsd: notes.marketUsd ?? null,
    rangeAud: parseMoneyRange(notes.rangeAud || "") || (notes.valueAud ? { low: notes.valueAud, high: notes.valueAud } : null),
    rangeUsd: notes.marketUsd ? { low: notes.marketUsd, high: notes.marketUsd } : null,
    checkedAt: notes.marketChecked || null,
    sourceUrl: notes.sourceUrl || "",
    sourceLabel: notes.marketLabel || "Stored catalog notes",
    note: [notes.confidenceNote, "Stored notes / not live evidence."]
      .filter(Boolean)
      .join(" "),
    confidence: mapCatalogConfidence(notes.confidence),
  };
}

export function ownerEstimateAsEvidence(options: {
  amountAud?: number | null;
  sourceUrl?: string;
  checkedAt?: string | null;
}): ValuationEvidence | null {
  if (typeof options.amountAud !== "number" || !Number.isFinite(options.amountAud)) return null;
  return {
    kind: "stored_note",
    match: "unknown",
    condition: "unknown",
    amountAud: options.amountAud,
    rangeAud: { low: options.amountAud, high: options.amountAud },
    checkedAt: options.checkedAt || null,
    sourceUrl: options.sourceUrl || "",
    sourceLabel: "Owner estimate",
    note: "Owner-entered estimate. Not sold evidence and not a live market value.",
    confidence: "none",
  };
}

export function historyRowAsEvidence(row: {
  evidenceKind: string;
  matchKind: string;
  conditionKind: string;
  confidence?: string;
  rangeAudLow?: number | null;
  rangeAudHigh?: number | null;
  rangeUsdLow?: number | null;
  rangeUsdHigh?: number | null;
  sourceUrl?: string;
  note?: string;
  checkedAt?: string;
}): ValuationEvidence {
  const kind: EvidenceKind =
    row.evidenceKind === "sold" || row.evidenceKind === "asking" ? row.evidenceKind : "stored_note";
  const match: MatchKind = row.matchKind === "exact" || row.matchKind === "comparable" ? row.matchKind : "unknown";
  const condition: ConditionKind =
    row.conditionKind === "raw" || row.conditionKind === "graded" ? row.conditionKind : "unknown";
  const rangeAud =
    typeof row.rangeAudLow === "number" && typeof row.rangeAudHigh === "number"
      ? { low: Math.min(row.rangeAudLow, row.rangeAudHigh), high: Math.max(row.rangeAudLow, row.rangeAudHigh) }
      : null;
  const rangeUsd =
    typeof row.rangeUsdLow === "number" && typeof row.rangeUsdHigh === "number"
      ? { low: Math.min(row.rangeUsdLow, row.rangeUsdHigh), high: Math.max(row.rangeUsdLow, row.rangeUsdHigh) }
      : null;
  return {
    kind,
    match,
    condition,
    rangeAud,
    rangeUsd,
    amountAud: rangeAud ? rangeAud.low : null,
    amountUsd: rangeUsd ? rangeUsd.low : null,
    checkedAt: row.checkedAt || null,
    sourceUrl: row.sourceUrl || "",
    sourceLabel: evidenceBadge(kind),
    note: row.note || "",
    confidence:
      row.confidence === "high" || row.confidence === "moderate" || row.confidence === "low" || row.confidence === "none"
        ? row.confidence
        : kind === "sold"
          ? "moderate"
          : "low",
  };
}

export function summarizeValuation(evidence: ValuationEvidence[]): CardValuation {
  const sold = evidence.filter((item) => item.kind === "sold");
  const asking = evidence.filter((item) => item.kind === "asking");
  const notes = evidence.filter((item) => item.kind === "stored_note");
  const estimatedSource = sold.length > 0 ? sold : notes;
  const estimatedFrom = sold.length > 0 ? "sold" : notes.length > 0 ? "stored_note" : null;
  const meta = pickMeta(estimatedSource);
  const sources: CardValuation["sources"] = [];
  for (const item of evidence) {
    if (!item.sourceUrl || sources.some((source) => source.url === item.sourceUrl)) continue;
    sources.push({
      url: item.sourceUrl,
      label: item.sourceLabel || evidenceBadge(item.kind),
      kind: item.kind,
    });
  }

  let headline = "No live market value";
  let disclaimer = "The vault does not invent sold comps or treat asking prices as sales.";
  if (sold.length > 0) {
    headline = "Recorded sold evidence";
    disclaimer = "Range is from completed-sale evidence you recorded. Asking prices are listed separately and are not sold.";
  } else if (notes.length > 0) {
    headline = "Stored notes / not live evidence";
    disclaimer = "These figures are stored research notes, not a live sold-comp feed and not asking prices labelled as sold.";
  } else if (asking.length > 0) {
    headline = "Asking prices only";
    disclaimer = "Active listings are asking prices, not sold evidence. No live value is invented from them.";
  }

  return {
    estimatedRangeAud: rangeFromEvidence(estimatedSource, "AUD"),
    estimatedRangeUsd: rangeFromEvidence(estimatedSource, "USD"),
    askingRangeAud: rangeFromEvidence(asking, "AUD"),
    askingRangeUsd: rangeFromEvidence(asking, "USD"),
    estimatedFrom,
    checkedAt: latestDate(estimatedSource) || latestDate(evidence),
    sources,
    match: estimatedSource.length > 0 ? meta.match : "unknown",
    condition: estimatedSource.length > 0 ? meta.condition : "unknown",
    confidence: estimatedSource.length > 0 ? meta.confidence : "none",
    liveMarketValue: false,
    headline,
    disclaimer,
    evidence,
  };
}

export function valuationFromCatalogNotes(notes: CatalogPriceNotes) {
  const evidence = catalogNotesAsEvidence(notes);
  const summary = summarizeValuation([evidence]);
  return {
    ...summary,
    confidence: mapCatalogConfidence(notes.confidence),
    headline: "Stored notes / not live evidence",
    disclaimer: "Hardcoded catalog figures stay labelled as stored notes until real sold evidence is recorded. Asking prices are never shown as sold.",
  };
}

export function matchKindLabel(match: MatchKind) {
  if (match === "exact") return "Exact card";
  if (match === "comparable") return "Comparable";
  return "Match unknown";
}

export function conditionKindLabel(condition: ConditionKind) {
  if (condition === "raw") return "Raw / ungraded";
  if (condition === "graded") return "Graded";
  return "Condition unknown";
}
