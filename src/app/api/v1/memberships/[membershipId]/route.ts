import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { changeMembershipSchema } from "@/schemas/membership";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ membershipId: string }> };

export const PUT = route(async (request: NextRequest, context: Context) => {
  const { membershipId } = await context.params;
  const input = await parseJson(request, changeMembershipSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("change_store_membership", {
    membership_id: uuidSchema.parse(membershipId),
    input,
  }));
});
