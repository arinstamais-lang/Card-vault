import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../../../db";
import { assets } from "../../../db/schema";
import {
  collectionErrorMessage,
  deleteOwnedAsset,
  listOwnedAssets,
  listOwnedFinancials,
  patchValuesFromInput,
  requireOwnedAsset,
  serializeAsset,
  upsertOwnedFinancial,
} from "../../../lib/collection";
import { storedAssetKey } from "../../../lib/vault-policy";
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
  wishlist: z.boolean().optional(),
  showcase: z.boolean().optional(),
});

const assetPatchInput = z
  .object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1, "Name is required").max(120).optional(),
    description: z.string().trim().max(500).optional(),
    serial: z.string().trim().max(80).optional(),
    sourceUrl: z.string().trim().max(1_000).optional(),
    manualValueAud: z.number().nonnegative().nullable().optional(),
    quantity: z.number().positive().max(1_000_000).optional(),
    purity: z.number().positive().max(1).optional(),
    unit: z.enum(["item", "g", "oz"]).optional(),
    wishlist: z.boolean().optional(),
    showcase: z.boolean().optional(),
    purchasePriceAud: z.number().nonnegative().max(100_000_000).nullable().optional(),
    purchaseDate: z.string().trim().max(10).optional(),
  })
  .refine(
    (value) =>
      [
        value.name,
        value.description,
        value.serial,
        value.sourceUrl,
        value.manualValueAud,
        value.quantity,
        value.purity,
        value.unit,
        value.wishlist,
        value.showcase,
        value.purchasePriceAud,
        value.purchaseDate,
      ].some((field) => field !== undefined),
    { message: "No changes provided" },
  );

const assetDeleteInput = z.object({
  id: z.number().int().positive(),
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
  return collectionErrorMessage(error, "The asset could not be saved right now.");
}

export async function GET() {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const rows = await listOwnedAssets(identity);
    return Response.json({ assets: rows.map(serializeAsset) });
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
      .values({
        category: value.category,
        name: value.name,
        description: value.description,
        quantity: value.quantity,
        unit: value.unit,
        purity: value.purity,
        manualValueAud: value.manualValueAud,
        imageUrl: value.imageUrl,
        backImageUrl: value.backImageUrl,
        serial: value.serial,
        sourceUrl: value.sourceUrl,
        scanStatus: value.scanStatus,
        wishlist: value.wishlist ? 1 : 0,
        showcase: value.showcase ? 1 : 0,
        ownerId: identity.user.id,
      })
      .returning();
    return Response.json({ asset: serializeAsset(asset) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const parsed = assetPatchInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Check the asset details" },
        { status: 400 },
      );
    }

    const value = parsed.data;
    const owned = await requireOwnedAsset(identity, value.id);
    if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status });

    if (value.sourceUrl !== undefined && !validOptionalUrl(value.sourceUrl)) {
      return Response.json({ error: "Image and source links must be valid web addresses" }, { status: 400 });
    }

    const patch = patchValuesFromInput(value);
    let asset = owned.row;
    if (Object.keys(patch).length > 0) {
      const [updated] = await getDb()
        .update(assets)
        .set(patch)
        .where(and(eq(assets.id, owned.row.id), inArray(assets.ownerId, identity.ownerIds)))
        .returning();
      if (!updated) return Response.json({ error: "This item belongs to another vault" }, { status: 403 });
      asset = updated;
    }

    let financial = null;
    if (value.purchasePriceAud !== undefined || value.purchaseDate !== undefined) {
      const current = (await listOwnedFinancials(identity)).find((row) => row.assetKey === storedAssetKey(asset.id));
      const saved = await upsertOwnedFinancial(identity, {
        assetKey: storedAssetKey(asset.id),
        purchasePriceAud: value.purchasePriceAud !== undefined ? value.purchasePriceAud : current?.purchasePriceAud ?? null,
        purchaseDate: value.purchaseDate !== undefined ? value.purchaseDate : current?.purchaseDate ?? "",
      });
      if (!saved.ok) return Response.json({ error: saved.error }, { status: saved.status });
      financial = saved.financial;
    }

    return Response.json({ asset: serializeAsset(asset), financial });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const urlId = Number(new URL(request.url).searchParams.get("id") || "");
    let id = Number.isInteger(urlId) && urlId > 0 ? urlId : null;
    if (id === null) {
      const parsed = assetDeleteInput.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        return Response.json({ error: parsed.error.issues[0]?.message || "Asset id is required" }, { status: 400 });
      }
      id = parsed.data.id;
    }

    const deleted = await deleteOwnedAsset(identity, id);
    if (!deleted.ok) return Response.json({ error: deleted.error }, { status: deleted.status });
    return Response.json({ deleted: true, id: deleted.id });
  } catch (error) {
    return Response.json({ error: collectionErrorMessage(error, "The asset could not be deleted right now.") }, { status: 500 });
  }
}
