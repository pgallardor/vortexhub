import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ membershipId: string }> };

export const POST = route(async (_request: Request, context: Context) => {
  const { membershipId } = await context.params;
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("disable_store_membership", {
    membership_id: uuidSchema.parse(membershipId),
  }));
});
