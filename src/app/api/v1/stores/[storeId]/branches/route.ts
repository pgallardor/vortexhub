import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { createBranchSchema } from "@/schemas/branch";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ storeId: string }> };

export const POST = route(async (request: NextRequest, context: Context) => {
  const { storeId } = await context.params;
  const input = await parseJson(request, createBranchSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("create_active_branch", {
    store_id: uuidSchema.parse(storeId),
    input,
  }), 201);
});
