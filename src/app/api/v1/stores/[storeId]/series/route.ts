import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { createSeriesSchema } from "@/schemas/event";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ storeId: string }> };

export const POST = route(async (request: NextRequest, context: Context) => {
  const { storeId } = await context.params;
  const input = await parseJson(request, createSeriesSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("create_event_series", {
    store_id: uuidSchema.parse(storeId),
    input,
  }), 201);
});
