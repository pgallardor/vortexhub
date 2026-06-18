"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveMediaButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeAsset() {
    setIsRemoving(true);
    try {
      await fetch(`/api/v1/media/${assetId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <button className="button button-danger" disabled={isRemoving} onClick={removeAsset} type="button">
      {isRemoving ? "Removiendo..." : "Remover"}
    </button>
  );
}
