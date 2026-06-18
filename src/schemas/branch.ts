import { z } from "zod";
import { countryCodeSchema } from "@/lib/validation/common";

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(160),
  addressLine: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  countryCode: countryCodeSchema.nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timezone: z.string().trim().max(60).nullable().optional(),
}).superRefine((value, context) => {
  if ((value.latitude == null) !== (value.longitude == null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Latitud y longitud deben enviarse juntas.",
    });
  }
});
