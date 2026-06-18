import { createSupabaseServerClient } from "@/lib/supabase/server";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { PublicCalendarService } from "@/services/public-calendar-service";

export const GET = route(async () => {
  const service = new PublicCalendarService(await createSupabaseServerClient());
  return ok(await service.listGames());
});
