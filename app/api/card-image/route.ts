import { and, eq, inArray, or } from "drizzle-orm";

import { getDb } from "../../../db";
import { assets } from "../../../db/schema";
import { getBucket } from "../../../lib/storage";
import { getVaultIdentity } from "../../vault-auth";

export async function GET(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("scans/") || key.includes("..")) {
    return Response.json({ error: "Invalid image" }, { status: 400 });
  }

  const storedUrl = `/api/card-image?key=${encodeURIComponent(key)}`;
  const [ownedAsset] = await getDb()
    .select({ id: assets.id })
    .from(assets)
    .where(and(
      inArray(assets.ownerId, identity.ownerIds),
      or(eq(assets.imageUrl, storedUrl), eq(assets.backImageUrl, storedUrl)),
    ))
    .limit(1);
  if (!ownedAsset) return Response.json({ error: "Image not found" }, { status: 404 });

  const object = await getBucket().get(key);
  if (!object) return Response.json({ error: "Image not found" }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "content-type": object.customMetadata?.contentType || "image/jpeg",
      "cache-control": "private, max-age=86400",
      ...(object.httpEtag ? { etag: object.httpEtag } : {}),
    },
  });
}
