import { createHash, createHmac, randomUUID } from "node:crypto";

const qrPayloadPrefix = "vhpqr:v1";

export type PlayerQrCredentialMaterial = {
  displayNonce: string;
  qrSecret: string;
  qrTokenHash: string;
  qrPayload: string;
};

export function createPlayerQrCredentialMaterial(): PlayerQrCredentialMaterial {
  return buildPlayerQrCredentialMaterial(randomUUID());
}

export function buildPlayerQrCredentialMaterial(displayNonce: string): PlayerQrCredentialMaterial {
  const qrSecret = createHmac("sha256", requiredQrPepper())
    .update(displayNonce)
    .digest("base64url");
  const qrTokenHash = createHash("sha256").update(qrSecret).digest("hex");

  return {
    displayNonce,
    qrSecret,
    qrTokenHash,
    qrPayload: `${qrPayloadPrefix}:${displayNonce}:${qrSecret}`,
  };
}

function requiredQrPepper() {
  const value = process.env.VORTEXHUB_QR_PEPPER;
  if (!value || value.length < 32) {
    throw new Error("Missing required server-only VORTEXHUB_QR_PEPPER with at least 32 characters.");
  }
  return value;
}
