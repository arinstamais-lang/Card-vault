import type { ConfirmedCardFields } from "./card-fields";

export type EbayListingKind = "active" | "sold";

export type AffiliateSettings = {
  campaignId?: string | null;
  marketplaceId?: string | null;
  toolId?: string | null;
};

export const AFFILIATE_QUERY_KEYS = ["mkevt", "mkcid", "mkrid", "campid", "toolid", "customid"] as const;
export const MAX_EBAY_QUERY_LENGTH = 300;
const SOURCE_PATTERN = /^[a-z0-9_-]{1,40}$/i;

function cleanToken(value: string) {
  return value.replaceAll("·", " ").replace(/[“”"']/g, "").replace(/\s+/g, " ").trim();
}

function hasToken(haystack: string, needle: string) {
  if (!needle) return true;
  const hay = haystack.toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 1)
    .every((part) => hay.includes(part));
}

export function buildEbaySearchPhrase(fields: Partial<ConfirmedCardFields> & { name?: string }): string {
  const grade =
    fields.grader && fields.grade
      ? `${fields.grader} ${fields.grade}`
      : fields.grade || fields.grader || "";
  const candidates = [
    fields.year,
    fields.setName || fields.manufacturer,
    fields.name,
    fields.cardNumber,
    fields.parallel,
    fields.rookie ? "RC" : "",
    fields.autograph && !/autograph/i.test(fields.parallel || "") ? "Autograph" : "",
    fields.serial,
    grade,
  ]
    .map((part) => cleanToken(part || ""))
    .filter(Boolean);

  const unique: string[] = [];
  for (const part of candidates) {
    const next = [...unique, part].join(" ");
    if (unique.some((existing) => hasToken(existing, part))) continue;
    if (hasToken(unique.join(" "), part) && part.split(" ").length > 1) continue;
    unique.push(part);
    if (next.length > MAX_EBAY_QUERY_LENGTH) break;
  }

  return unique.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_EBAY_QUERY_LENGTH);
}

export function parseEbayListingKind(value: string | null | undefined): EbayListingKind {
  return String(value || "").trim().toLowerCase() === "sold" ? "sold" : "active";
}

export function sanitizeEbaySource(value: string | null | undefined) {
  const source = (value || "search").trim();
  return SOURCE_PATTERN.test(source) ? source : "search";
}

export function hasAffiliateCampaign(settings: AffiliateSettings | null | undefined) {
  const campaignId = settings?.campaignId?.trim() || "";
  const marketplaceId = settings?.marketplaceId?.trim() || "";
  return Boolean(campaignId && marketplaceId);
}

export function applyAffiliateParams(url: URL, settings: AffiliateSettings | null | undefined, source?: string) {
  if (!hasAffiliateCampaign(settings)) return false;
  url.searchParams.set("mkevt", "1");
  url.searchParams.set("mkcid", "1");
  url.searchParams.set("mkrid", settings!.marketplaceId!.trim());
  url.searchParams.set("campid", settings!.campaignId!.trim());
  url.searchParams.set("toolid", settings?.toolId?.trim() || "10001");
  url.searchParams.set("customid", `vault-${sanitizeEbaySource(source)}`);
  return true;
}

export function trackingParamsPresent(url: string | URL) {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return AFFILIATE_QUERY_KEYS.some((key) => parsed.searchParams.has(key));
}

export function buildEbayAustraliaSearch(options: {
  query: string;
  kind?: string | null;
  source?: string | null;
  affiliate?: AffiliateSettings | null;
}) {
  const kind = parseEbayListingKind(options.kind);
  const query = cleanToken(options.query).slice(0, MAX_EBAY_QUERY_LENGTH);
  const destination = new URL("https://www.ebay.com.au/sch/i.html");
  destination.searchParams.set("_nkw", query || "collectible cards");
  destination.searchParams.set("_sacat", "0");

  if (kind === "sold") {
    destination.searchParams.set("LH_Sold", "1");
    destination.searchParams.set("LH_Complete", "1");
  } else {
    destination.searchParams.set("LH_PrefLoc", "1");
  }

  const trackingEnabled = applyAffiliateParams(destination, options.affiliate, options.source || undefined);
  return {
    url: destination.toString(),
    kind,
    trackingEnabled,
    query: query || "collectible cards",
  };
}

export function ebayVaultPath(options: {
  query: string;
  kind?: EbayListingKind | string | null;
  source?: string | null;
}) {
  const parameters = new URLSearchParams({
    q: cleanToken(options.query).slice(0, MAX_EBAY_QUERY_LENGTH),
    kind: parseEbayListingKind(options.kind),
    source: sanitizeEbaySource(options.source),
  });
  return `/go/ebay?${parameters.toString()}`;
}
