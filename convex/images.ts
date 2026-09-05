import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// All delivery-provider knowledge stays here for a future image-service migration.
export async function imageUrl(ctx: Pick<QueryCtx, "storage">, image: Doc<"photographs">["image"]) {
  return image.provider === "convex" ? ctx.storage.getUrl(image.storageId) : image.url;
}
