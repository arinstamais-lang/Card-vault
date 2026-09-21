import { desc, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../../../db";
import { assets } from "../../../db/schema";
import { getVaultIdentity } from "../../vault-auth";

const assetInput = z.object({
  category: z.enum(["card", "gold", "silver", "rare"]),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).default(""),
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(["item", "g", "oz"]),
  purity: z.number().positive().max(1),
  manualValueAud: z.number().nonnegative().nullable(),
  imageUrl: z.string().trim().max(1_000).default(""),
  backImageUrl: z.string().trim().max(1_000).default(""),
  serial: z.string().trim().max(80).default(""),
  sourceUrl: z.string().trim().max(1_000).default(""),
  scanStatus: z.string().trim().max(40).default(""),
});

function validOptionalUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table") || message.includes('from "assets"')) {
    return "The collection database is still being prepared. Try again after the next publish.";
  }
  return "The asset could not be saved right now.";
}

export async function GET() {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const rows = await getDb()
      .select()
      .from(assets)
      .where(inArray(assets.ownerId, identity.ownerIds))
      .orderBy(desc(assets.createdAt), desc(assets.id))
      .limit(200);
    return Response.json({ assets: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const parsed = assetInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Check the asset details" },
        { status: 400 },
      );
    }

    const value = parsed.data;
    const isMetal = value.category === "gold" || value.category === "silver";
    if (isMetal && value.unit === "item") {
      return Response.json({ error: "Choose grams or troy ounces for metals" }, { status: 400 });
    }
    if (!isMetal && value.unit !== "item") {
      return Response.json({ error: "Cards and collectibles use item quantity" }, { status: 400 });
    }
    if (!validOptionalUrl(value.imageUrl) || !validOptionalUrl(value.backImageUrl) || !validOptionalUrl(value.sourceUrl)) {
      return Response.json(
        { error: "Image and source links must be valid web addresses" },
        { status: 400 },
      );
    }

    const [asset] = await getDb()
      .insert(assets)
      .values({ ...value, ownerId: identity.user.id })
      .returning();
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
