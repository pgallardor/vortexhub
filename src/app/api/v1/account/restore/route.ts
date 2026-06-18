import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DomainCommandService } from "@/services/domain-command-service";

export const POST = route(async () => {
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("restore_account_before_anonymization"));
});
