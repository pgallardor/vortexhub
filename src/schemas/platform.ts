import { z } from "zod";
import { timestampSchema, uuidSchema } from "@/lib/validation/common";

export const grantEntitlementSchema = z.object({
  feature: z.literal("custom_event_banners"),
  startsAt: timestampSchema,
  endsAt: timestampSchema.nullable().optional(),
}).superRefine((value, context) => {
  if (value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "El término debe ser posterior al inicio.",
    });
  }
});

export const manageGameSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  publisher: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean(),
});

export const managePlatformBannerSchema = z.object({
  gameId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).max(160),
  storagePath: z.string().min(1).max(1000),
  isDefault: z.boolean(),
  status: z.enum(["active", "inactive"]),
});

export const platformReasonSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
