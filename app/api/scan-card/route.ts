import { getDb } from "../../../db";
import { assets } from "../../../db/schema";
import {
  isAllowedScanImageType,
  normalizeImageContentType,
  normalizeManualValueAud,
  normalizeScanName,
  normalizeYear,
} from "../../../lib/scan-card-input";
import { getBucket } from "../../../lib/storage";
import { getVaultIdentity } from "../../vault-auth";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function textField(form: FormData, key: string, max: number) {
  return String(form.get(key) || "").trim().slice(0, max);
}

function validImage(value: FormDataEntryValue | null): value is File {
  return (
    value instanceof File &&
    value.size > 0 &&
    value.size <= MAX_IMAGE_BYTES &&
    isAllowedScanImageType(value.type)
  );
}

export async function POST(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  const form = await request.formData();
  const front = form.get("front");
  const back = form.get("back");
  const nameResult = normalizeScanName(textField(form, "name", 120));
  if (!nameResult.ok) return Response.json({ error: nameResult.error }, { status: 400 });

  if (!validImage(front) || !validImage(back)) {
    return Response.json({ error: "Add clear front and back photos under 8 MB each" }, { status: 400 });
  }

  const yearResult = normalizeYear(textField(form, "year", 4));
  if (!yearResult.ok) return Response.json({ error: yearResult.error }, { status: 400 });

  const valueResult = normalizeManualValueAud(textField(form, "manualValueAud", 30));
  if (!valueResult.ok) return Response.json({ error: valueResult.error }, { status: 400 });

  const cardId = crypto.randomUUID();
  const frontType = normalizeImageContentType(front.type);
  const backType = normalizeImageContentType(back.type);
  const frontExtension = frontType.includes("png") ? "png" : frontType.includes("webp") ? "webp" : frontType.includes("hei") ? "heic" : "jpg";
  const backExtension = backType.includes("png") ? "png" : backType.includes("webp") ? "webp" : backType.includes("hei") ? "heic" : "jpg";
  const frontKey = `scans/${cardId}-front.${frontExtension}`;
  const backKey = `scans/${cardId}-back.${backExtension}`;
  const bucket = getBucket();

  try {
    await Promise.all([
      bucket.put(frontKey, await front.arrayBuffer(), {
        httpMetadata: { contentType: frontType },
        customMetadata: { contentType: frontType, ownerId: identity.user.id },
      }),
      bucket.put(backKey, await back.arrayBuffer(), {
        httpMetadata: { contentType: backType },
        customMetadata: { contentType: backType, ownerId: identity.user.id },
      }),
    ]);

    const year = yearResult.year;
    const sport = textField(form, "sport", 80);
    const setName = textField(form, "setName", 160);
    const cardNumber = textField(form, "cardNumber", 80);
    const parallel = textField(form, "parallel", 160);
    const notes = textField(form, "description", 500);
    const detectedDetails = [
      year,
      setName,
      sport,
      cardNumber ? `Card ${cardNumber.replace(/^#/, "")}` : "",
      parallel,
    ].filter(Boolean);
    const description = [detectedDetails.join(" · "), notes].filter(Boolean).join(" · ").slice(0, 500);

    const [asset] = await getDb().insert(assets).values({
      ownerId: identity.user.id,
      category: "card",
      name: nameResult.name,
      description,
      quantity: 1,
      unit: "item",
      purity: 1,
      manualValueAud: valueResult.manualValueAud,
      imageUrl: `/api/card-image?key=${encodeURIComponent(frontKey)}`,
      backImageUrl: `/api/card-image?key=${encodeURIComponent(backKey)}`,
      serial: textField(form, "serial", 80),
      sourceUrl: "",
      scanStatus: textField(form, "autoDetected", 5) === "true" ? "identified" : "pending_research",
    }).returning();

    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    await Promise.allSettled([bucket.delete(frontKey), bucket.delete(backKey)]);
    const detail = error instanceof Error ? error.message : "";
    // Surface recognizable constraint/pattern failures without dumping stacks.
    if (/match|pattern|constraint|UNIQUE|CHECK/i.test(detail)) {
      return Response.json(
        { error: "Could not save this card. Check year (blank or 4 digits) and try again." },
        { status: 400 },
      );
    }
    return Response.json({ error: "The card could not be saved. Your photos were not kept." }, { status: 500 });
  }
}
