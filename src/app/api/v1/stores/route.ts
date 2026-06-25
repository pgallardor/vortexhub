import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/http/errors";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStoreSchema } from "@/schemas/store";
import { DomainCommandService } from "@/services/domain-command-service";

export const POST = route(async (request: NextRequest) => {
  const input = await parseJson(request, createStoreSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  const result = await service.execute<{ id: string } | { id: string }[]>("create_store", { input });
  const store = Array.isArray(result) ? result[0] : result;
  if (!store?.id) {
    throw new ApiError(500, "INTERNAL_ERROR", "La tienda fue creada, pero la respuesta no incluyó su identificador.");
  }
  return ok({ id: store.id }, 201);
});
