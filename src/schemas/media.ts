import { z } from "zod";

export const beginMediaUploadSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z.number().int().positive().max(5 * 1024 * 1024),
});

export const finalizeMediaAssetSchema = z.object({
  sourceStoragePath: z.string().min(1).max(1000),
  optimizedStoragePath: z.string().min(1).max(1000),
  detectedMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  detectedByteSize: z.number().int().positive().max(5 * 1024 * 1024),
  width: z.number().int().min(1200),
  height: z.number().int().min(675),
});

export const moderateMediaAssetSchema = z.object({
  action: z.literal("remove"),
  reason: z.string().trim().min(5).max(240),
});
