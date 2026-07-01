"use client";

import { useEffect, useMemo, useState } from "react";
import { queueUserFeedback } from "@/components/user-feedback";

export function StoreCalendarShareLink({
  storeName,
  storeSlug,
  compact = false,
}: {
  storeName: string;
  storeSlug: string;
  compact?: boolean;
}) {
  const [host, setHost] = useState("");
  const path = `/c/${storeSlug}`;
  const url = useMemo(() => `${host}${path}`, [host, path]);
  const displayUrl = host ? url.replace(/^https?:\/\//, "") : path;

  useEffect(() => {
    setHost(window.location.origin);
  }, []);

  async function copyShareLink() {
    const shareUrl = `${window.location.origin}${path}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      queueUserFeedback({
        tone: "success",
        title: "Link copiado",
        description: `El calendario de ${storeName} quedó listo para compartir.`,
      }, { deliverNow: true });
    } catch {
      queueUserFeedback({
        tone: "error",
        title: "No se pudo copiar",
        description: "Copia el link manualmente desde el campo mostrado.",
      }, { deliverNow: true });
    }
  }

  async function shareCalendar() {
    const shareUrl = `${window.location.origin}${path}`;

    if (!navigator.share) {
      await copyShareLink();
      return;
    }

    try {
      await navigator.share({
        title: `Calendario de ${storeName}`,
        text: `Revisa los próximos eventos de ${storeName} en VortexHub.`,
        url: shareUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      queueUserFeedback({
        tone: "error",
        title: "No se pudo compartir",
        description: "Prueba copiando el link corto del calendario.",
      }, { deliverNow: true });
    }
  }

  return (
    <div className={`calendar-share-link${compact ? " calendar-share-link-compact" : ""}`}>
      <div>
        <span>Link corto</span>
        <code>{displayUrl}</code>
      </div>
      <div className="calendar-share-actions">
        <button className="button button-secondary" onClick={copyShareLink} type="button">
          Copiar
        </button>
        <button className="button button-primary" onClick={shareCalendar} type="button">
          Compartir
        </button>
      </div>
    </div>
  );
}
