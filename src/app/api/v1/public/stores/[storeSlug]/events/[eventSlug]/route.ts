import { createSupabaseServerClient } from "@/lib/supabase/server";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { slugSchema } from "@/lib/validation/common";
import { PublicCalendarService } from "@/services/public-calendar-service";

type Context = {
  params: Promise<{ storeSlug: string; eventSlug: string }>;
};

export const GET = route(async (_request: Request, context: Context) => {
  const params = await context.params;
  const storeSlug = slugSchema.parse(params.storeSlug);
  const eventSlug = slugSchema.parse(params.eventSlug);
  const service = new PublicCalendarService(await createSupabaseServerClient());
  return ok(await service.getEvent(storeSlug, eventSlug));
});
