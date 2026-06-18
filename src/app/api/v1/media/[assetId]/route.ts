import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ assetId: string }> };

export const DELETE = route(async (_request: Request, context: Context) => {
  const { assetId } = await context.params;
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("remove_store_media_asset", {
    asset_id: uuidSchema.parse(assetId),
  }));
});
