import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { cancelEventSchema } from "@/schemas/event";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ eventId: string }> };

export const POST = route(async (request: NextRequest, context: Context) => {
  const { eventId } = await context.params;
  const body = await parseJson(request, cancelEventSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("cancel_event", {
    event_id: uuidSchema.parse(eventId),
    public_message: body.publicMessage,
  }));
});
