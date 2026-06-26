import { LaterStageNotice } from "@/components/frontend";
import { PublicShell } from "@/components/public-shell";

export default function PlayerQrPage() {
  return <PublicShell><main className="page-container"><LaterStageNotice feature="QR personal" /></main></PublicShell>;
}
