import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ storeId: string }> };

export const POST = route(async (_request: Request, context: Context) => {
  const { storeId } = await context.params;
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("activate_store", { store_id: uuidSchema.parse(storeId) }));
});
