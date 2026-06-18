import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptLegalDocumentSchema } from "@/schemas/account";
import { DomainCommandService } from "@/services/domain-command-service";

export const POST = route(async (request: NextRequest) => {
  const body = await parseJson(request, acceptLegalDocumentSchema);
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("accept_legal_document", { version_id: body.versionId }), 201);
});
