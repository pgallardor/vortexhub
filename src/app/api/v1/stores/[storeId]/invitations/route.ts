import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { invitationSchema } from "@/schemas/store";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ storeId: string }> };

export const POST = route(async (request: NextRequest, context: Context) => {
  const { storeId } = await context.params;
  const input = await parseJson(request, invitationSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("invite_store_member", {
    store_id: uuidSchema.parse(storeId),
    input,
  }), 201);
});
