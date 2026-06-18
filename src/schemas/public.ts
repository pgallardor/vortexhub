import { z } from "zod";
import { dateSchema, paginationSchema, slugSchema } from "@/lib/validation/common";

export const publicCalendarQuerySchema = paginationSchema.extend({
  game: slugSchema.optional(),
  store: slugSchema.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
