import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseQuery, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { publicCalendarQuerySchema } from "@/schemas/public";
import { PublicCalendarService } from "@/services/public-calendar-service";

export const GET = route(async (request: NextRequest) => {
  const filters = await parseQuery(request, publicCalendarQuerySchema);
  const service = new PublicCalendarService(await createSupabaseServerClient());
  return ok(await service.listCalendar(filters));
});
