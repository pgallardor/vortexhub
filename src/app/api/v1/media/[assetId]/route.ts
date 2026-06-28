import type { NextRequest } from "next/server";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { ApiError } from "@/lib/http/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ assetId: string }> };

export const DELETE = route(async (_request: Request, context: Context) => {
  const { assetId } = await context.params;
  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("remove_store_media_asset", {
    asset_id: uuidSchema.parse(assetId),
  }));
});

export const PATCH = route(async (request: NextRequest, context: Context) => {
  const { assetId } = await context.params;
  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (displayName.length < 2 || displayName.length > 120) {
    throw new ApiError(422, "VALIDATION_ERROR", "El nombre del banner debe tener entre 2 y 120 caracteres.");
  }

  const service = new DomainCommandService(await createSupabaseServerClient());
  return ok(await service.execute("rename_store_media_asset", {
    asset_id: uuidSchema.parse(assetId),
    display_name: displayName,
  }));
});
