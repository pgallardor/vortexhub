import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { createPlayerQrCredentialMaterial, buildPlayerQrCredentialMaterial } from "@/lib/player/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerQrApiPayload, PlayerQrPayload } from "@/schemas/player";
import { DomainCommandService } from "@/services/domain-command-service";

export const POST = route(async () => {
  const material = createPlayerQrCredentialMaterial();
  const service = new DomainCommandService(await createSupabaseServerClient());
  const qr = await service.execute<PlayerQrPayload>("rotate_my_player_qr", {
    input: {
      qrDisplayNonce: material.displayNonce,
      qrTokenHash: material.qrTokenHash,
    },
  });

  return ok<PlayerQrApiPayload>({
    ...qr,
    qrPayload: buildPlayerQrCredentialMaterial(qr.credential.displayNonce).qrPayload,
  });
});
