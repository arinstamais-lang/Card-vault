import { z } from "zod";

import { collectionErrorMessage } from "../../../lib/collection";
import {
  insertOwnedValuation,
  listOwnedValuations,
  serializeValuation,
} from "../../../lib/valuation-store";
import { getVaultIdentity } from "../../vault-auth";

const optionalMoney = z.number().nonnegative().max(100_000_000).nullable().optional();

const valuationInput = z.object({
  assetKey: z.string().trim().min(1).max(180),
  checkedAt: z.string().trim().max(40).optional(),
  evidenceKind: z.enum(["sold", "asking", "stored_note"]),
  matchKind: z.enum(["exact", "comparable", "unknown"]).default("unknown"),
  conditionKind: z.enum(["raw", "graded", "unknown"]).default("unknown"),
  confidence: z.enum(["none", "low", "moderate", "high"]).default("low"),
  rangeAudLow: optionalMoney,
  rangeAudHigh: optionalMoney,
  rangeUsdLow: optionalMoney,
  rangeUsdHigh: optionalMoney,
  sourceUrl: z.string().trim().max(1_000).default(""),
  note: z.string().trim().max(500).default(""),
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

function rangePair(low: number | null | undefined, high: number | null | undefined) {
  const start = low ?? null;
  const end = high ?? null;
  if (start === null && end === null) return { low: null, high: null };
  if (start === null || end === null) {
    const amount = start ?? end;
    return { low: amount, high: amount };
  }
  if (end < start) return { error: "Range high must be at least the low amount" as const };
  return { low: start, high: end };
}

function errorMessage(error: unknown) {
  return collectionErrorMessage(error, "Valuation notes could not be saved right now.");
}

export async function GET(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const assetKey = new URL(request.url).searchParams.get("assetKey")?.trim() || "";
    const rows = await listOwnedValuations(identity, assetKey || undefined);
    return Response.json({ valuations: rows.map(serializeValuation) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const parsed = valuationInput.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message || "Check the valuation details" },
        { status: 400 },
      );
    }

    const value = parsed.data;
    if (!validOptionalUrl(value.sourceUrl)) {
      return Response.json({ error: "Source links must be valid web addresses" }, { status: 400 });
    }

    const aud = rangePair(value.rangeAudLow, value.rangeAudHigh);
    const usd = rangePair(value.rangeUsdLow, value.rangeUsdHigh);
    if ("error" in aud) return Response.json({ error: aud.error }, { status: 400 });
    if ("error" in usd) return Response.json({ error: usd.error }, { status: 400 });

    const saved = await insertOwnedValuation(identity, {
      assetKey: value.assetKey,
      checkedAt: value.checkedAt || new Date().toISOString(),
      evidenceKind: value.evidenceKind,
      matchKind: value.matchKind,
      conditionKind: value.conditionKind,
      confidence: value.confidence,
      rangeAudLow: aud.low,
      rangeAudHigh: aud.high,
      rangeUsdLow: usd.low,
      rangeUsdHigh: usd.high,
      sourceUrl: value.sourceUrl,
      note: value.note,
    });
    if (!saved.ok) return Response.json({ error: saved.error }, { status: saved.status });
    return Response.json({ valuation: serializeValuation(saved.valuation) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
