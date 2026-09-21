import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../../../db";
import { assetFinancials } from "../../../db/schema";
import { getVaultIdentity } from "../../vault-auth";

const financialInput = z.object({
  assetKey: z.string().trim().min(1).max(180),
  purchasePriceAud: z.number().nonnegative().max(100_000_000).nullable(),
  purchaseDate: z.string().trim().max(10).default(""),
});

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table") || message.includes("asset_financials")) {
    return "Purchase tracking is still being prepared. Try again after the next publish.";
  }
  return "Purchase details could not be saved right now.";
}

export async function GET() {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const rows = await getDb()
      .select()
      .from(assetFinancials)
      .where(inArray(assetFinancials.ownerId, identity.ownerIds))
      .orderBy(desc(assetFinancials.updatedAt))
      .limit(500);
    return Response.json({ financials: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const parsed = financialInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Check the purchase details" },
        { status: 400 },
      );
    }

    const value = parsed.data;
    const updatedAt = new Date().toISOString();
    const [existing] = await getDb()
      .select({ ownerId: assetFinancials.ownerId })
      .from(assetFinancials)
      .where(eq(assetFinancials.assetKey, value.assetKey))
      .limit(1);
    if (existing && !identity.ownerIds.includes(existing.ownerId)) {
      return Response.json({ error: "This item belongs to another vault" }, { status: 403 });
    }

    const [financial] = await getDb()
      .insert(assetFinancials)
      .values({ ...value, ownerId: identity.user.id, updatedAt })
      .onConflictDoUpdate({
        target: assetFinancials.assetKey,
        set: {
          purchasePriceAud: value.purchasePriceAud,
          purchaseDate: value.purchaseDate,
          ownerId: identity.user.id,
          updatedAt,
        },
      })
      .returning();

    return Response.json({ financial });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
