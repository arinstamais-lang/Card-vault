/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

import { seedPhotoAccess } from "../lib/vault-policy";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  VAULT_LEGACY_OWNER_ID?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const photoAccess = seedPhotoAccess({
      pathname: url.pathname,
      userId: request.headers.get(USER_ID_HEADER),
      email: request.headers.get(USER_EMAIL_HEADER),
      legacyOwnerUserId: typeof env.VAULT_LEGACY_OWNER_ID === "string" ? env.VAULT_LEGACY_OWNER_ID.trim() : "",
    });
    if (photoAccess === "unauthorized") return jsonError("Sign in required", 401);
    if (photoAccess === "not_found") return jsonError("Image not found", 404);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    if (photoAccess !== "allow") return response;

    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, max-age=86400");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

export default worker;
