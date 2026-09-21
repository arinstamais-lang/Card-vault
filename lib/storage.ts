import { env } from "cloudflare:workers";

type StoredObject = {
  body: ReadableStream;
  httpEtag?: string;
  customMetadata?: Record<string, string>;
};

type ObjectBucket = {
  put: (
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ) => Promise<unknown>;
  get: (key: string) => Promise<StoredObject | null>;
  delete: (key: string) => Promise<void>;
};

export function getBucket() {
  const bucket = (env as unknown as { BUCKET?: ObjectBucket }).BUCKET;
  if (!bucket) {
    throw new Error("Cloudflare R2 binding `BUCKET` is unavailable.");
  }
  return bucket;
}
