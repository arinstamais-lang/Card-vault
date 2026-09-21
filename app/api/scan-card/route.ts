import { getDb } from "../../../db";
import { assets } from "../../../db/schema";
import { getBucket } from "../../../lib/storage";
import { getVaultIdentity } from "../../vault-auth";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function textField(form: FormData, key: string, max: number) {
  return String(form.get(key) || "").trim().slice(0, max);
}

function validImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= MAX_IMAGE_BYTES && ALLOWED_TYPES.has(value.type);
}

export async function POST(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  const form = await request.formData();
  const front = form.get("front");
  const back = form.get("back");
  const name = textField(form, "name", 120);

  if (!name) return Response.json({ error: "Add the fighter or card name" }, { status: 400 });
  if (!validImage(front) || !validImage(back)) {
    return Response.json({ error: "Add clear front and back photos under 8 MB each" }, { status: 400 });
  }

  const cardId = crypto.randomUUID();
  const frontExtension = front.type.includes("png") ? "png" : front.type.includes("webp") ? "webp" : front.type.includes("hei") ? "heic" : "jpg";
  const backExtension = back.type.includes("png") ? "png" : back.type.includes("webp") ? "webp" : back.type.includes("hei") ? "heic" : "jpg";
  const frontKey = `scans/${cardId}-front.${frontExtension}`;
  const backKey = `scans/${cardId}-back.${backExtension}`;
  const bucket = getBucket();

  try {
    await Promise.all([
      bucket.put(frontKey, await front.arrayBuffer(), { httpMetadata: { contentType: front.type }, customMetadata: { contentType: front.type, ownerId: identity.user.id } }),
      bucket.put(backKey, await back.arrayBuffer(), { httpMetadata: { contentType: back.type }, customMetadata: { contentType: back.type, ownerId: identity.user.id } }),
    ]);

    const valueText = textField(form, "manualValueAud", 30);
    const manualValueAud = valueText ? Number(valueText) : null;
    if (manualValueAud !== null && (!Number.isFinite(manualValueAud) || manualValueAud < 0)) {
      await Promise.all([bucket.delete(frontKey), bucket.delete(backKey)]);
      return Response.json({ error: "Check the estimated value" }, { status: 400 });
    }

    const year = textField(form, "year", 4);
    const sport = textField(form, "sport", 80);
    const setName = textField(form, "setName", 160);
    const cardNumber = textField(form, "cardNumber", 80);
    const parallel = textField(form, "parallel", 160);
    const notes = textField(form, "description", 500);
    const detectedDetails = [
      year,
      setName,
      sport && sport !== "Trading card" ? sport : "",
      cardNumber ? `Card ${cardNumber.replace(/^#/, "")}` : "",
      parallel,
    ].filter(Boolean);
    const description = [detectedDetails.join(" · "), notes].filter(Boolean).join(" · ").slice(0, 500);

    const [asset] = await getDb().insert(assets).values({
      ownerId: identity.user.id,
      category: "card",
      name,
      description,
      quantity: 1,
      unit: "item",
      purity: 1,
      manualValueAud,
      imageUrl: `/api/card-image?key=${encodeURIComponent(frontKey)}`,
      backImageUrl: `/api/card-image?key=${encodeURIComponent(backKey)}`,
      serial: textField(form, "serial", 80),
      sourceUrl: "",
      scanStatus: textField(form, "autoDetected", 5) === "true" ? "identified" : "pending_research",
    }).returning();

    return Response.json({ asset }, { status: 201 });
  } catch {
    await Promise.allSettled([bucket.delete(frontKey), bucket.delete(backKey)]);
    return Response.json({ error: "The card could not be saved. Your photos were not kept." }, { status: 500 });
  }
}
