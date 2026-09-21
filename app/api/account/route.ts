import { z } from "zod";

import { collectionErrorMessage, deleteOwnedCollection } from "../../../lib/collection";
import { DELETE_VAULT_CONFIRMATION, isDeleteVaultConfirmation } from "../../../lib/vault-policy";
import { getVaultIdentity } from "../../vault-auth";

const deleteInput = z.object({
  confirm: z.string(),
});

export async function DELETE(request: Request) {
  const identity = await getVaultIdentity();
  if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const parsed = deleteInput.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success || !isDeleteVaultConfirmation(parsed.data.confirm)) {
      return Response.json(
        { error: `Type ${DELETE_VAULT_CONFIRMATION} to permanently delete your vault data` },
        { status: 400 },
      );
    }

    const result = await deleteOwnedCollection(identity);
    return Response.json({
      deleted: true,
      ...result,
      note: "Saved cards, notes, purchase prices and private scans for this account were removed. App-shipped catalog photos were not deleted.",
    });
  } catch (error) {
    return Response.json(
      { error: collectionErrorMessage(error, "The vault could not be deleted right now.") },
      { status: 500 },
    );
  }
}
