/** Pure helpers for confirm-and-add (scan → vault). Keep blank year legal. */

const YEAR_OK = /^(19|20)\d{2}$/;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function normalizeImageContentType(type: string) {
  const raw = String(type || "").trim().toLowerCase();
  if (!raw || raw === "application/octet-stream") return "image/jpeg";
  if (raw === "image/jpg") return "image/jpeg";
  // Strip parameters: "image/jpeg; codecs=..." → "image/jpeg"
  const base = raw.split(";")[0]?.trim() || "image/jpeg";
  if (base === "image/jpg") return "image/jpeg";
  return base;
}

export function isAllowedScanImageType(type: string) {
  const normalized = normalizeImageContentType(type);
  return ALLOWED_IMAGE_TYPES.has(normalized) || normalized.startsWith("image/");
}

export function normalizeYear(value: string) {
  const year = String(value || "").trim();
  if (!year) return { ok: true as const, year: "" };
  if (!YEAR_OK.test(year)) {
    return {
      ok: false as const,
      error: "Year can be blank or a 4-digit year like 2024",
    };
  }
  return { ok: true as const, year };
}

export function normalizeManualValueAud(value: string) {
  const text = String(value || "").trim();
  if (!text) return { ok: true as const, manualValueAud: null as number | null };
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false as const, error: "Check the estimated value" };
  }
  return { ok: true as const, manualValueAud: amount };
}

export function normalizeScanName(value: string) {
  const name = String(value || "").trim().slice(0, 120);
  if (!name) return { ok: false as const, error: "Add the fighter or card name" };
  return { ok: true as const, name };
}
