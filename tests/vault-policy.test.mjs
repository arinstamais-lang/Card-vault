import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const policy = await vite.ssrLoadModule("/lib/vault-policy.ts");
const media = await vite.ssrLoadModule("/lib/vault-media.ts");
const zip = await vite.ssrLoadModule("/lib/zip-store.ts");

const alice = { user: { id: "alice" }, isLegacyOwner: false, ownerIds: ["alice"] };
const bob = { user: { id: "bob" }, isLegacyOwner: false, ownerIds: ["bob"] };
const ari = { user: { id: "ari" }, isLegacyOwner: true, ownerIds: ["ari", "legacy-owner"] };

test("unsigned callers are not treated as owners", () => {
  const row = { id: 1, ownerId: "alice" };
  const denied = policy.accessOwnedRow(row, bob);
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 403);
  const missing = policy.accessOwnedRow(undefined, alice);
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
});

test("an owner can read their own row and not another vault", () => {
  const row = { id: 7, ownerId: "alice" };
  const allowed = policy.accessOwnedRow(row, alice);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.row.id, 7);

  const foreign = policy.accessOwnedRow(row, bob);
  assert.equal(foreign.ok, false);
  assert.equal(foreign.status, 403);
});

test("financial writes cannot squat another owner's stored asset key", () => {
  const blocked = policy.financialKeyWriteAccess(bob, "asset-5", [99]);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 403);

  const allowed = policy.financialKeyWriteAccess(alice, "asset-5", [5]);
  assert.equal(allowed.ok, true);
});

test("seed catalog financial keys are legacy-owner only", () => {
  const squat = policy.financialKeyWriteAccess(bob, "carlos-prates-cav-cps-69-99", []);
  assert.equal(squat.ok, false);
  assert.equal(squat.status, 403);

  const owner = policy.financialKeyWriteAccess(ari, "james-bond-60-years-1oz-silver", []);
  assert.equal(owner.ok, true);

  const unknown = policy.financialKeyWriteAccess(alice, "not-a-real-key", []);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.status, 400);
});

test("financial reads stay scoped to the caller even when asset keys collide", () => {
  const rows = [
    { assetKey: "asset-5", ownerId: "alice", purchasePriceAud: 12 },
    { assetKey: "asset-5", ownerId: "bob", purchasePriceAud: 999 },
  ];
  const visible = policy.preferCurrentOwnerFinancial(rows, alice);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].purchasePriceAud, 12);
});

test("delete confirmation is exact", () => {
  assert.equal(policy.isDeleteVaultConfirmation("DELETE MY VAULT"), true);
  assert.equal(policy.isDeleteVaultConfirmation("delete my vault"), false);
  assert.equal(policy.isDeleteVaultConfirmation(""), false);
});

test("seed photos are not world-readable", () => {
  assert.equal(
    policy.seedPhotoAccess({
      pathname: "/cards/carlos-prates-cav-cps-69-99-front.webp",
      userId: null,
      email: null,
    }),
    "unauthorized",
  );
  assert.equal(
    policy.seedPhotoAccess({
      pathname: "/cards/carlos-prates-cav-cps-69-99-front.webp",
      userId: "bob",
      email: "bob@example.com",
      legacyOwnerUserId: "ari",
    }),
    "not_found",
  );
  assert.equal(
    policy.seedPhotoAccess({
      pathname: "/cards/carlos-prates-cav-cps-69-99-front.webp",
      userId: "ari",
      email: "ari@example.com",
      legacyOwnerUserId: "ari",
    }),
    "allow",
  );
  assert.equal(
    policy.seedPhotoAccess({
      pathname: "/",
      userId: null,
      email: null,
    }),
    "skip",
  );
});

test("private scan URLs map to R2 keys and reject traversal", () => {
  assert.equal(
    media.r2KeyFromVaultUrl("/api/card-image?key=scans%2Fabc-front.jpg"),
    "scans/abc-front.jpg",
  );
  assert.equal(media.r2KeyFromVaultUrl("/api/card-image?key=../secret"), null);
  assert.equal(media.r2KeyFromVaultUrl("/cards/public.webp"), null);
});

test("zip export stores private JSON without extra compression", () => {
  const archive = zip.createZipStore([
    zip.zipTextFile("assets.json", JSON.stringify({ purchasePriceAud: 40 })),
  ]);
  const bytes = Buffer.from(archive);
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  assert.match(bytes.toString("binary"), /assets\.json/);
  assert.match(bytes.toString("utf8"), /purchasePriceAud/);
});
