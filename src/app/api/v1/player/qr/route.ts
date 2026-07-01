import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { buildPlayerQrCredentialMaterial } from "@/lib/player/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerQrApiPayload, PlayerQrPayload } from "@/schemas/player";
import { DomainCommandService } from "@/services/domain-command-service";

export const GET = route(async () => {
  const service = new DomainCommandService(await createSupabaseServerClient());
  const qr = await service.execute<PlayerQrPayload | null>("get_my_player_qr");

  if (!qr) return ok(null);

  return ok<PlayerQrApiPayload>({
    ...qr,
    qrPayload: buildPlayerQrCredentialMaterial(qr.credential.displayNonce).qrPayload,
  });
});
