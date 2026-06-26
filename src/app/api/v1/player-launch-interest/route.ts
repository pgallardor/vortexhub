import type { NextRequest } from "next/server";
import { parseJson, route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { RpcRepository } from "@/lib/database/rpc-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlayerLaunchInterestSchema } from "@/schemas/player-interest";

export const POST = route(async (request: NextRequest) => {
  const input = await parseJson(request, createPlayerLaunchInterestSchema);
  const rpc = new RpcRepository(await createSupabaseServerClient());
  await rpc.call("register_player_launch_interest", {
    input: {
      email: input.email,
      source: input.source,
      consentLaunchEmail: input.consentLaunchEmail,
    },
  });

  return ok({ status: "registered" }, 201);
});
