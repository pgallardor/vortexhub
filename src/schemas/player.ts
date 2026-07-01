import { z } from "zod";

export const playerProfileInputSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, "El nickname debe tener al menos 2 caracteres.")
    .max(40, "El nickname no puede superar 40 caracteres."),
});

export type PlayerProfileInput = z.infer<typeof playerProfileInputSchema>;

export type PlayerProfile = {
  id: string;
  nickname: string;
  playerTag: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlayerQrPayload = {
  profile: PlayerProfile;
  credential: {
    id: string;
    displayNonce: string;
    issuedAt: string;
    canRotateAfter: string;
  };
};

export type PlayerQrApiPayload = PlayerQrPayload & {
  qrPayload: string;
};
