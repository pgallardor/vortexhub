import { z } from "zod";
import { uuidSchema } from "@/lib/validation/common";

export const acceptLegalDocumentSchema = z.object({
  versionId: uuidSchema,
});

export const createAccountSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
});
