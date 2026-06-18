import { z } from "zod";
import { slugSchema, uuidSchema } from "@/lib/validation/common";

export const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema.optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  timezone: z.string().trim().min(1).max(60),
});

export const closeResourceSchema = z.object({
  publicMessage: z.string().trim().min(5).max(240),
  internalReason: z.string().trim().max(2000).nullable().optional(),
});

export const invitationSchema = z
  .object({
    email: z.string().email().max(320),
    role: z.enum(["owner", "admin", "staff"]),
    scope: z.enum(["store", "branches"]),
    branchIds: z.array(uuidSchema).max(100).default([]),
  })
  .superRefine((value, context) => {
    if (value.scope === "branches" && value.branchIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchIds"],
        message: "El alcance por sucursales requiere al menos una sucursal.",
      });
    }
    if (value.scope === "store" && value.branchIds.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["branchIds"],
        message: "El alcance de tienda no acepta sucursales.",
      });
    }
    if (value.role === "owner" && value.scope !== "store") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope"],
        message: "Un owner siempre tiene alcance de tienda.",
      });
    }
  });

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(512),
});
