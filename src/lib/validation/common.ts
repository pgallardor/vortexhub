import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const slugSchema = z
  .string()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const dateSchema = z.string().date();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);
export const timestampSchema = z.string().datetime({ offset: true });
export const httpsUrlSchema = z
  .string()
  .url()
  .superRefine((value, context) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe ser una URL HTTPS absoluta y sin credenciales embebidas.",
      });
    }
  });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});
