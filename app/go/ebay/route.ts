import { env } from "cloudflare:workers";

const MAX_QUERY_LENGTH = 300;
const SOURCE_PATTERN = /^[a-z0-9_-]{1,40}$/i;

function runtimeSetting(name: string) {
  const runtime = env as unknown as Record<string, unknown>;
  const value = runtime[name];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = (requestUrl.searchParams.get("q") || "").trim().slice(0, MAX_QUERY_LENGTH);
  const requestedSource = requestUrl.searchParams.get("source") || "search";
  const source = SOURCE_PATTERN.test(requestedSource) ? requestedSource : "search";

  const destination = new URL("https://www.ebay.com.au/sch/i.html");
  destination.searchParams.set("_nkw", query || "collectible cards");
  destination.searchParams.set("_sacat", "0");
  destination.searchParams.set("LH_PrefLoc", "1");

  const campaignId = runtimeSetting("EBAY_CAMPAIGN_ID");
  const marketplaceId = runtimeSetting("EBAY_MARKETPLACE_ID");

  // Tracking remains off until eBay approves the account and both values are set.
  if (campaignId && marketplaceId) {
    destination.searchParams.set("mkevt", "1");
    destination.searchParams.set("mkcid", "1");
    destination.searchParams.set("mkrid", marketplaceId);
    destination.searchParams.set("campid", campaignId);
    destination.searchParams.set("toolid", runtimeSetting("EBAY_TOOL_ID") || "10001");
    destination.searchParams.set("customid", `vault-${source}`);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: destination.toString(),
      "cache-control": "no-store",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}
