"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { Field } from "@/components/frontend";
import type { StoreSummary } from "@/lib/frontend/domain";

type BranchPayload = {
  name: string;
  addressLine?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
};

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

function trimOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }

  if (!body.data) throw new Error("La respuesta del servidor no incluyó datos.");
  return body.data;
}

function locationQuery(parts: {
  addressLine: string;
  city: string;
  region: string;
  countryCode: string;
}) {
  return [parts.addressLine, parts.city, parts.region, parts.countryCode]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function BranchForm({ store }: { store: StoreSummary }) {
  const router = useRouter();
  const isSubmittingRef = useRef(false);
  const [locationDraft, setLocationDraft] = useState({
    addressLine: "",
    city: "",
    region: "",
    countryCode: "CL",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapQuery = useMemo(() => locationQuery(locationDraft), [locationDraft]);
  const canPreviewMap = Boolean(locationDraft.addressLine.trim() && locationDraft.city.trim() && locationDraft.countryCode.trim());
  const encodedMapQuery = encodeURIComponent(mapQuery);

  function buildPayload(formData: FormData): BranchPayload {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("Ingresa el nombre de la sucursal.");

    const addressLine = trimOrNull(formData.get("addressLine"));
    const city = trimOrNull(formData.get("city"));
    const countryCode = trimOrNull(formData.get("countryCode"))?.toUpperCase() ?? null;

    if (!addressLine || !city || !countryCode) {
      throw new Error("Para activar la sucursal ingresa dirección, ciudad y país.");
    }

    return {
      name,
      addressLine,
      city,
      region: trimOrNull(formData.get("region")),
      countryCode,
      timezone: trimOrNull(formData.get("timezone")),
    };
  }

  async function onSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const form = submitEvent.currentTarget;
      const formData = new FormData(form);
      const payload = buildPayload(formData);
      const response = await fetch(`/api/v1/stores/${store.id}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readApiResponse<{ id: string }>(response);

      form.reset();
      setLocationDraft({
        addressLine: "",
        city: "",
        region: "",
        countryCode: "CL",
      });
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos guardar la sucursal.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-card form-grid branch-form" id="new-branch" onSubmit={onSubmit}>
      <div className="form-section-heading">
        <div>
          <p className="eyebrow">Ubicación de eventos</p>
          <h2>Nueva sucursal</h2>
        </div>
      </div>
      <Field label="Nombre">
        <input name="name" placeholder="Sucursal Centro" required />
      </Field>
      <Field label="Dirección">
        <input
          name="addressLine"
          onChange={(event) => setLocationDraft((current) => ({ ...current, addressLine: event.target.value }))}
          placeholder="Av. Principal 123"
          value={locationDraft.addressLine}
        />
      </Field>
      <div className="form-grid two">
        <Field label="Ciudad">
          <input
            name="city"
            onChange={(event) => setLocationDraft((current) => ({ ...current, city: event.target.value }))}
            placeholder="Santiago"
            value={locationDraft.city}
          />
        </Field>
        <Field label="Región">
          <input
            name="region"
            onChange={(event) => setLocationDraft((current) => ({ ...current, region: event.target.value }))}
            placeholder="Región Metropolitana"
            value={locationDraft.region}
          />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="País">
          <input
            maxLength={2}
            name="countryCode"
            onChange={(event) => setLocationDraft((current) => ({
              ...current,
              countryCode: event.target.value.toUpperCase(),
            }))}
            placeholder="CL"
            value={locationDraft.countryCode}
          />
        </Field>
        <Field label="Zona horaria" hint="Si la dejas vacía, se usa la zona horaria de la tienda.">
          <input defaultValue={store.timezone} name="timezone" placeholder="America/Santiago" />
        </Field>
      </div>
      <section className="branch-map-preview" aria-label="Vista previa del mapa">
        <div className="branch-map-preview-copy">
          <p className="eyebrow">Mapa</p>
          <h3>Vista del mapa</h3>
          <p>{canPreviewMap ? mapQuery : "Mapa pendiente"}</p>
          {canPreviewMap ? (
            <a
              className="button button-secondary"
              href={`https://www.google.com/maps/search/?api=1&query=${encodedMapQuery}`}
              rel="noreferrer"
              target="_blank"
            >
              Abrir en Google Maps ↗
            </a>
          ) : null}
        </div>
        <div className="location-map-frame">
          {canPreviewMap ? (
            <iframe
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodedMapQuery}&z=16&output=embed`}
              title="Vista previa de la sucursal"
            />
          ) : (
            <div className="branch-map-empty">Mapa pendiente</div>
          )}
        </div>
      </section>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <div className="button-row">
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creando..." : "Crear sucursal"}
        </button>
      </div>
    </form>
  );
}
