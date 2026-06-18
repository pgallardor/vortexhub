import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { closeResourceSchema } from "@/schemas/store";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ storeId: string }> };

export const POST = route(async (request: NextRequest, context: Context) => {
  const { storeId } = await context.params;
  const body = await parseJson(request, closeResourceSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("close_store_immediately", {
    store_id: uuidSchema.parse(storeId),
    public_message: body.publicMessage,
    internal_reason: body.internalReason,
  }));
});
