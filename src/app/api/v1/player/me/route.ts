import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createPlayerQrCredentialMaterial } from "@/lib/player/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { playerProfileInputSchema, type PlayerProfile } from "@/schemas/player";
import { DomainCommandService } from "@/services/domain-command-service";

export const GET = route(async () => {
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute<PlayerProfile | null>("get_my_player_profile"));
});

export const POST = route(async (request: NextRequest) => {
  const input = await parseJson(request, playerProfileInputSchema);
  const qr = createPlayerQrCredentialMaterial();
  const service = new DomainCommandService(await createSupabaseServerClient());

  return ok(await service.execute<PlayerProfile>("ensure_player_profile", {
    input: {
      nickname: input.nickname,
      qrDisplayNonce: qr.displayNonce,
      qrTokenHash: qr.qrTokenHash,
      source: "player_profile_page",
    },
  }), 201);
});
