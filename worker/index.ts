/** Cloudflare Worker entry point for Ari's Card Vault. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

import { readSessionUserFromRequest } from "../lib/session";
import { seedPhotoAccess } from "../lib/vault-policy";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET?: unknown;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
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

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

async function photoAccessFor(pathname: string, request: Request, env: Env) {
  const user = await readSessionUserFromRequest(request, env.SESSION_SECRET);
  const legacyOwnerUserId = typeof env.VAULT_LEGACY_OWNER_ID === "string" ? env.VAULT_LEGACY_OWNER_ID.trim() : "";
  return seedPhotoAccess({
    pathname,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    legacyOwnerUserId,
  });
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const photoAccess = await photoAccessFor(url.pathname, request, env);
    if (photoAccess === "unauthorized") return jsonError("Sign in required", 401);
    if (photoAccess === "not_found") return jsonError("Image not found", 404);

    if (url.pathname === "/sw.js" || url.pathname === "/manifest.webmanifest") {
      const response = await handler.fetch(request, env, ctx);
      const headers = new Headers(response.headers);
      if (url.pathname === "/sw.js") {
        headers.set("content-type", "application/javascript; charset=utf-8");
        headers.set("service-worker-allowed", "/");
        headers.set("cache-control", "no-cache");
      } else {
        headers.set("content-type", "application/manifest+json; charset=utf-8");
        headers.set("cache-control", "no-cache");
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

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
