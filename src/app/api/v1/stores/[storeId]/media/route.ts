import type { NextRequest } from "next/server";
import { route } from "@/lib/http/route";
import { ok } from "@/lib/http/responses";
import { ApiError } from "@/lib/http/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";
import { DomainCommandService } from "@/services/domain-command-service";

type Context = { params: Promise<{ storeId: string }> };

const allowedSourceTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function parsePositiveInt(value: FormDataEntryValue | null, field: string) {
  const parsed = Number(String(value ?? ""));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(422, "VALIDATION_ERROR", `${field} no es válido.`);
  }
  return parsed;
}

function validateAssetType(value: FormDataEntryValue | null): "store_logo" | "event_banner" {
  const assetType = String(value ?? "");
  if (assetType !== "store_logo" && assetType !== "event_banner") {
    throw new ApiError(422, "VALIDATION_ERROR", "Tipo de media inválido.");
  }
  return assetType;
}

function validateFile(value: FormDataEntryValue | null, field: string, expectedType?: string) {
  if (!(value instanceof File)) {
    throw new ApiError(422, "VALIDATION_ERROR", `${field} es requerido.`);
  }
  if (value.size <= 0 || value.size > maxBytes) {
    throw new ApiError(422, "VALIDATION_ERROR", `${field} supera el tamaño permitido.`);
  }
  if (expectedType && value.type !== expectedType) {
    throw new ApiError(422, "VALIDATION_ERROR", `${field} debe ser ${expectedType}.`);
  }
  return value;
}

function displayNameFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length < 2) return "Banner custom";
  return normalized.slice(0, 120);
}

function validateDisplayName(
  value: FormDataEntryValue | null,
  assetType: "store_logo" | "event_banner",
  fallbackFileName: string,
) {
  if (assetType !== "event_banner") return null;
  const displayName = String(value ?? "").trim() || displayNameFromFileName(fallbackFileName);
  if (displayName.length < 2 || displayName.length > 120) {
    throw new ApiError(422, "VALIDATION_ERROR", "El nombre del banner debe tener entre 2 y 120 caracteres.");
  }
  return displayName;
}

export const POST = route(async (request: NextRequest, context: Context) => {
  const { storeId } = await context.params;
  const parsedStoreId = uuidSchema.parse(storeId);
  const formData = await request.formData();
  const assetType = validateAssetType(formData.get("assetType"));
  const sourceFile = validateFile(formData.get("sourceFile"), "sourceFile");
  const displayName = validateDisplayName(formData.get("displayName"), assetType, sourceFile.name);
  const optimizedFile = validateFile(formData.get("optimizedFile"), "optimizedFile", "image/webp");
  const width = parsePositiveInt(formData.get("width"), "width");
  const height = parsePositiveInt(formData.get("height"), "height");

  if (!allowedSourceTypes.has(sourceFile.type)) {
    throw new ApiError(422, "VALIDATION_ERROR", "El archivo fuente debe ser JPEG, PNG o WebP.");
  }

  if (assetType === "store_logo" && (width < 256 || height < 256)) {
    throw new ApiError(422, "VALIDATION_ERROR", "El logo debe medir al menos 256 x 256 px.");
  }

  if (assetType === "event_banner" && (width < 1200 || height < 675)) {
    throw new ApiError(422, "VALIDATION_ERROR", "El banner debe medir al menos 1200 x 675 px.");
  }

  const supabase = await createSupabaseServerClient();
  if (assetType === "event_banner") {
    const { count, error: countError } = await supabase
      .from("store_media_assets")
      .select("id", { count: "exact", head: true })
      .eq("store_id", parsedStoreId)
      .eq("asset_type", "event_banner")
      .eq("status", "active")
      .is("deleted_at", null);

    if (countError) throw new ApiError(403, "FORBIDDEN", countError.message);
    if ((count ?? 0) >= 5) {
      throw new ApiError(422, "VALIDATION_ERROR", "Puedes mantener hasta 5 banners custom activos.");
    }
  }

  const assetId = crypto.randomUUID();
  const sourcePath = `${parsedStoreId}/${assetType}/${assetId}/source.${extensionForMimeType(sourceFile.type)}`;
  const optimizedPath = `${parsedStoreId}/${assetType}/${assetId}/optimized.webp`;

  const { error: sourceError } = await supabase.storage
    .from("store-media-sources")
    .upload(sourcePath, sourceFile, {
      contentType: sourceFile.type,
      upsert: false,
    });
  if (sourceError) throw new ApiError(403, "FORBIDDEN", sourceError.message);

  const { error: optimizedError } = await supabase.storage
    .from("store-media-optimized")
    .upload(optimizedPath, optimizedFile, {
      contentType: optimizedFile.type,
      upsert: false,
    });
  if (optimizedError) throw new ApiError(403, "FORBIDDEN", optimizedError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("store-media-optimized").getPublicUrl(optimizedPath);

  const service = new DomainCommandService(supabase);
  const asset = await service.execute("register_store_media_asset", {
    store_id: parsedStoreId,
    asset_type: assetType,
    display_name: displayName,
    source_storage_path: sourcePath,
    optimized_storage_path: optimizedPath,
    public_url: publicUrl,
    mime_type: sourceFile.type,
    byte_size: sourceFile.size,
    width,
    height,
  });

  return ok(asset, 201);
});
