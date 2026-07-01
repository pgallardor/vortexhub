"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { queueUserFeedback } from "@/components/user-feedback";
import type { PlayerQrApiPayload } from "@/schemas/player";

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }
  if (!body.data) throw new Error("La respuesta del servidor no incluyó datos.");
  return body.data;
}

function canRotate(canRotateAfter: string) {
  return Date.now() >= new Date(canRotateAfter).getTime();
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatUtcDateTime(value: string) {
  const date = new Date(value);
  return `${pad(date.getUTCDate())}-${pad(date.getUTCMonth() + 1)}-${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function formatUtcTime(value: string) {
  const date = new Date(value);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function PlayerQrPanel({ initialQr }: { initialQr: PlayerQrApiPayload }) {
  const [qr, setQr] = useState(initialQr);
  const [isRotating, setIsRotating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationReady = canRotate(qr.credential.canRotateAfter);

  useEffect(() => {
    if (!canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, qr.qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#101722",
        light: "#ffffff",
      },
    }).catch(() => {
      setErrorMessage("No pudimos dibujar el QR en este navegador.");
    });
  }, [qr.qrPayload]);

  async function rotateQr() {
    if (!rotationReady || isRotating) return;

    setErrorMessage(null);
    setIsRotating(true);

    try {
      const nextQr = await readApiResponse<PlayerQrApiPayload>(await fetch("/api/v1/player/qr/rotate", {
        method: "POST",
      }));
      setQr(nextQr);
      queueUserFeedback({
        tone: "success",
        title: "QR rotado",
        description: "El QR anterior quedó revocado inmediatamente.",
      }, { deliverNow: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos rotar el QR.");
    } finally {
      setIsRotating(false);
    }
  }

  async function copyPayload() {
    await navigator.clipboard.writeText(qr.qrPayload);
    queueUserFeedback({
      tone: "info",
      title: "Payload copiado",
      description: "Úsalo solo para pruebas internas de Stage 2.",
    }, { deliverNow: true });
  }

  return (
    <section className="player-qr-workspace">
      <div className="player-qr-card">
        <canvas ref={canvasRef} aria-label="QR personal de jugador" />
      </div>
      <div className="player-qr-details">
        <span className="eyebrow">QR personal</span>
        <h1>{qr.profile.nickname} <span>· {qr.profile.playerTag}</span></h1>
        <p>
          Este QR identifica tu perfil solo dentro de una accion autenticada y autorizada por una
          tienda. No es una contraseña ni abre un perfil publico.
        </p>
        <dl className="player-qr-meta">
          <div>
            <dt>Emitido</dt>
            <dd><time dateTime={qr.credential.issuedAt}>{formatUtcDateTime(qr.credential.issuedAt)}</time></dd>
          </div>
          <div>
            <dt>Rotacion disponible</dt>
            <dd>
              {rotationReady ? (
                "Ahora"
              ) : (
                <time dateTime={qr.credential.canRotateAfter}>{formatUtcTime(qr.credential.canRotateAfter)}</time>
              )}
            </dd>
          </div>
        </dl>
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        <div className="button-row">
          <button className="button button-primary" disabled={!rotationReady || isRotating} onClick={rotateQr} type="button">
            {isRotating ? "Rotando..." : "Rotar QR"}
          </button>
          <button className="button button-secondary" onClick={copyPayload} type="button">
            Copiar payload
          </button>
          <Link className="button button-secondary" href="/player/me">Ver perfil</Link>
        </div>
      </div>
    </section>
  );
}
