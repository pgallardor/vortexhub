import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAccountSchema } from "@/schemas/account";
import { DomainCommandService } from "@/services/domain-command-service";

export const POST = route(async (request: NextRequest) => {
  const input = await parseJson(request, createAccountSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("create_user_account", { input }), 201);
});

export const DELETE = route(async () => {
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("request_account_deletion"));
});
