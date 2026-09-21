import { env } from "cloudflare:workers";

import {
  buildEbayAustraliaSearch,
  MAX_EBAY_QUERY_LENGTH,
  sanitizeEbaySource,
} from "../../../lib/ebay-search";

function runtimeSetting(name: string) {
  const runtime = env as unknown as Record<string, unknown>;
  const value = runtime[name];
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const query = (requestUrl.searchParams.get("q") || "").trim().slice(0, MAX_EBAY_QUERY_LENGTH);
  const source = sanitizeEbaySource(requestUrl.searchParams.get("source"));
  const destination = buildEbayAustraliaSearch({
    query,
    kind: requestUrl.searchParams.get("kind"),
    source,
    affiliate: {
      campaignId: runtimeSetting("EBAY_CAMPAIGN_ID"),
      marketplaceId: runtimeSetting("EBAY_MARKETPLACE_ID"),
      toolId: runtimeSetting("EBAY_TOOL_ID"),
    },
  });

  return new Response(null, {
    status: 302,
    headers: {
      location: destination.url,
      "cache-control": "no-store",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}
