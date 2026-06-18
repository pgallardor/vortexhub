import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { setBranchAssignmentsSchema } from "@/schemas/membership";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ membershipId: string }> };

export const PUT = route(async (request: NextRequest, context: Context) => {
  const { membershipId } = await context.params;
  const body = await parseJson(request, setBranchAssignmentsSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("set_branch_membership_assignments", {
    membership_id: uuidSchema.parse(membershipId),
    branch_ids: body.branchIds,
  }));
});
