import { z } from "zod";
import {
  countryCodeSchema,
  currencySchema,
  dateSchema,
  httpsUrlSchema,
  slugSchema,
  timeSchema,
  timestampSchema,
  uuidSchema,
} from "@/lib/validation/common";

const registrationSchema = z.discriminatedUnion("registrationMode", [
  z.object({
    registrationMode: z.literal("disabled"),
    externalRegistrationUrl: z.null().optional(),
  }),
  z.object({
    registrationMode: z.literal("external"),
    externalRegistrationUrl: httpsUrlSchema,
  }),
]);

const locationSchema = z.discriminatedUnion("locationMode", [
  z.object({
    locationMode: z.literal("branch"),
    branchId: uuidSchema,
    locationText: z.null().optional(),
    locationCity: z.null().optional(),
    locationRegion: z.null().optional(),
    locationCountryCode: z.null().optional(),
  }),
  z.object({
    locationMode: z.literal("custom"),
    branchId: uuidSchema.nullable().optional(),
    locationText: z.string().trim().min(2).max(500),
    locationCity: z.string().trim().min(1).max(120),
    locationRegion: z.string().trim().max(120).nullable().optional(),
    locationCountryCode: countryCodeSchema,
  }),
  z.object({
    locationMode: z.literal("online"),
    branchId: uuidSchema.nullable().optional(),
    locationText: z.string().trim().min(2).max(500),
    locationCity: z.null().optional(),
    locationRegion: z.null().optional(),
    locationCountryCode: z.null().optional(),
  }),
]);

const bannerSchema = z.discriminatedUnion("bannerMode", [
  z.object({
    bannerMode: z.literal("platform"),
    platformBannerId: uuidSchema,
    customBannerAssetId: z.null().optional(),
  }),
  z.object({
    bannerMode: z.literal("custom"),
    platformBannerId: z.null().optional(),
    customBannerAssetId: uuidSchema,
  }),
]);

const bannerPositionSchema = z.enum([
  "center 20%",
  "center 32%",
  "center 42%",
  "center",
  "center 58%",
  "center 68%",
  "center 80%",
  "left center",
  "right center",
]);

const sharedEventFields = z.object({
  gameId: uuidSchema,
  otherGameName: z.string().trim().min(1).max(120).nullable().optional(),
  slug: slugSchema.optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).nullable().optional(),
  formatName: z.string().trim().max(120).nullable().optional(),
  entryFeeAmount: z.number().nonnegative().max(9999999999.99).nullable().optional(),
  entryFeeCurrency: currencySchema.nullable().optional(),
  bannerPosition: bannerPositionSchema.default("center"),
}).superRefine((value, context) => {
  if ((value.entryFeeAmount == null) !== (value.entryFeeCurrency == null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Monto y moneda deben enviarse juntos.",
    });
  }
});

export const createEventSchema = z.intersection(
  sharedEventFields,
  z.intersection(
    registrationSchema,
    z.intersection(
      locationSchema,
      z.intersection(
        bannerSchema,
        z.object({
          startsAt: timestampSchema,
          endsAt: timestampSchema.nullable().optional(),
        }),
      ),
    ),
  ),
).superRefine((value, context) => {
  if (value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "La fecha de término debe ser posterior al inicio.",
    });
  }
});

export const updateEventSchema = createEventSchema;

export const cancelEventSchema = z.object({
  publicMessage: z.string().trim().min(5).max(240),
});

export const createSeriesSchema = z.intersection(
  sharedEventFields,
  z.intersection(
    registrationSchema,
    z.intersection(
      locationSchema,
      z.intersection(
        bannerSchema,
        z.object({
          weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7)
            .refine((days) => new Set(days).size === days.length, "Los días deben ser únicos."),
          localStartTime: timeSchema,
          durationMinutes: z.number().int().positive().nullable().optional(),
          timezone: z.string().trim().min(1).max(60),
          startsOn: dateSchema,
          endsOn: dateSchema.nullable().optional(),
        }),
      ),
    ),
  ),
).superRefine((value, context) => {
  if (value.endsOn && value.endsOn < value.startsOn) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsOn"],
      message: "La fecha de término debe ser igual o posterior al inicio.",
    });
  }
});

export const updateSeriesSchema = createSeriesSchema;
