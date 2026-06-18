import { z } from "zod";
import { uuidSchema } from "@/lib/validation/common";

export const changeMembershipSchema = z
  .object({
    role: z.enum(["owner", "admin", "staff"]),
    scope: z.enum(["store", "branches"]),
    branchIds: z.array(uuidSchema).max(100).default([]),
  })
  .superRefine((value, context) => {
    if (value.role === "owner" && value.scope !== "store") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope"],
        message: "Un owner siempre tiene alcance de tienda.",
      });
    }
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
  });

export const setBranchAssignmentsSchema = z.object({
  branchIds: z.array(uuidSchema).min(1).max(100),
});
