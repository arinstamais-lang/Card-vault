import { collectionErrorMessage, listOwnedAssets, listOwnedFinancials, serializeAsset } from "../../../lib/collection";
import { r2KeysForAsset, zipImageName } from "../../../lib/vault-media";
import { asFlag } from "../../../lib/vault-policy";
import { getBucket } from "../../../lib/storage";
import { createZipStore, zipTextFile } from "../../../lib/zip-store";
import { getVaultIdentity } from "../../vault-auth";

const MAX_EXPORT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EXPORT_IMAGES = 80;

export async function GET() {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const [assetRows, financials] = await Promise.all([
      listOwnedAssets(identity),
      listOwnedFinancials(identity),
    ]);
    const assets = assetRows.map(serializeAsset);
    const financialsByKey = new Map(financials.map((row) => [row.assetKey, row]));

    const exportedAssets = assets.map((asset) => {
      const financial = financialsByKey.get(`asset-${asset.id}`);
      return {
        id: asset.id,
        category: asset.category,
        name: asset.name,
        notes: asset.description,
        quantity: asset.quantity,
        unit: asset.unit,
        purity: asset.purity,
        serial: asset.serial,
        sourceUrl: asset.sourceUrl,
        scanStatus: asset.scanStatus,
        wishlist: asFlag(asset.wishlist),
        showcase: asFlag(asset.showcase),
        createdAt: asset.createdAt,
        purchasePriceAud: financial?.purchasePriceAud ?? null,
        purchaseDate: financial?.purchaseDate || "",
        imageFiles: r2KeysForAsset(asset).map(zipImageName),
      };
    });

    const manifest = {
      format: "aris-card-vault-export-v1",
      exportedAt: new Date().toISOString(),
      owner: {
        id: identity.user.id,
        email: identity.user.email,
        displayName: identity.user.displayName,
      },
      privacy: {
        purchasePricesIncluded: true,
        purchasePricesPublic: false,
        note: "This file is a private copy of your vault. Purchase prices stay in this download and are not a public share.",
        soldPrices: "Not included. The vault does not invent sold comps or scrape live eBay sold listings.",
      },
      counts: {
        assets: exportedAssets.length,
        financials: financials.length,
      },
      seedCatalog: {
        includedAsAppCatalog: identity.isLegacyOwner,
        copiedIntoZip: false,
        note: identity.isLegacyOwner
          ? "App-shipped UFC and silver catalog photos are not copied here. Private scans and D1 records are."
          : "Catalog sample photos that ship with the app are not part of this account export.",
      },
    };

    const files = [
      zipTextFile("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`),
      zipTextFile("assets.json", `${JSON.stringify(exportedAssets, null, 2)}\n`),
      zipTextFile(
        "financials.json",
        `${JSON.stringify(
          financials.map((row) => ({
            assetKey: row.assetKey,
            purchasePriceAud: row.purchasePriceAud,
            purchaseDate: row.purchaseDate,
            updatedAt: row.updatedAt,
          })),
          null,
          2,
        )}\n`,
      ),
    ];

    let bucket: ReturnType<typeof getBucket> | null = null;
    try {
      bucket = getBucket();
    } catch {
      bucket = null;
    }

    if (bucket) {
      const imageKeys = [...new Set(assetRows.flatMap((asset) => r2KeysForAsset(asset)))].slice(0, MAX_EXPORT_IMAGES);
      for (const key of imageKeys) {
        const object = await bucket.get(key);
        if (!object) continue;
        const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_EXPORT_IMAGE_BYTES) continue;
        files.push({ name: zipImageName(key), data: bytes });
      }
    }

    const zip = createZipStore(files);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(zip, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="card-vault-export-${stamp}.zip"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: collectionErrorMessage(error, "The collection could not be exported right now.") },
      { status: 500 },
    );
  }
}
