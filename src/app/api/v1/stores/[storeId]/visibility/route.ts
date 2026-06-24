import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { storeVisibilitySchema } from "@/schemas/store";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ storeId: string }> };

export const PATCH = route(async (request: NextRequest, context: Context) => {
  const { storeId } = await context.params;
  const input = await parseJson(request, storeVisibilitySchema);
  const service = new DomainCommandService(await createSupabaseServerClient());

  return ok(await service.execute("set_store_public_visibility", {
    store_id: uuidSchema.parse(storeId),
    is_visible: input.isPubliclyVisible,
  }));
});
