import { z } from "zod";

import { collectionErrorMessage, listOwnedFinancials, upsertOwnedFinancial } from "../../../lib/collection";
import { getVaultIdentity } from "../../vault-auth";

const financialInput = z.object({
  assetKey: z.string().trim().min(1).max(180),
  purchasePriceAud: z.number().nonnegative().max(100_000_000).nullable(),
  purchaseDate: z.string().trim().max(10).default(""),
});

function errorMessage(error: unknown) {
  return collectionErrorMessage(error, "Purchase details could not be saved right now.");
}

export async function GET() {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const rows = await listOwnedFinancials(identity);
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

    const saved = await upsertOwnedFinancial(identity, parsed.data);
    if (!saved.ok) return Response.json({ error: saved.error }, { status: saved.status });
    return Response.json({ financial: saved.financial });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
