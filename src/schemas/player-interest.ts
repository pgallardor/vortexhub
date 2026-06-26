import { z } from "zod";

export const createPlayerLaunchInterestSchema = z.object({
  email: z.string().trim().email().max(320),
  source: z.literal("player_tab").default("player_tab"),
  consentLaunchEmail: z.literal(true),
});
