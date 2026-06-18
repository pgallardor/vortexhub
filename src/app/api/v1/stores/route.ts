import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStoreSchema } from "@/schemas/store";
import { DomainCommandService } from "@/services/domain-command-service";

export const POST = route(async (request: NextRequest) => {
  const input = await parseJson(request, createStoreSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("create_store", { input }), 201);
});
