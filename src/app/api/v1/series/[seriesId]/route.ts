import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { updateSeriesSchema } from "@/schemas/event";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ seriesId: string }> };

export const PUT = route(async (request: NextRequest, context: Context) => {
  const { seriesId } = await context.params;
  const input = await parseJson(request, updateSeriesSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("update_event_series", {
    series_id: uuidSchema.parse(seriesId),
    input,
  }));
});
