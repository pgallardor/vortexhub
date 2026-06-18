"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { type CSSProperties, type FormEvent, useMemo, useState } from "react";
import { Field } from "@/components/frontend";
import type { AdminGameOption, AdminPlatformBannerOption, AdminStoreMediaAsset } from "@/lib/frontend/admin-data";
import type { BranchSummary, EventSummary, LocationMode, RegistrationMode, StoreSummary } from "@/lib/frontend/domain";

type EventPayload = {
  gameId: string;
  otherGameName: string | null;
  title: string;
  description: string | null;
  formatName: string | null;
  entryFeeAmount: number | null;
  entryFeeCurrency: string | null;
  registrationMode: RegistrationMode;
  externalRegistrationUrl?: string | null;
  locationMode: LocationMode;
  branchId?: string | null;
  locationText?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationCountryCode?: string | null;
  bannerMode: "platform" | "custom";
  platformBannerId?: string | null;
  bannerPosition: BannerPosition;
  customBannerAssetId?: string | null;
  startsAt: string;
  endsAt?: string | null;
};

type BannerPosition =
  | "center 20%"
  | "center 32%"
  | "center 42%"
  | "center"
  | "center 58%"
  | "center 68%"
  | "center 80%"
  | "left center"
  | "right center";

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

function formatDateTimeLocal(value?: string | null, timeZone = "America/Santiago") {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(value));
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

function defaultDateTimeLocal() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function trimOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function isoFromDateTimeLocal(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseFeeAmount(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }

  if (!body.data) throw new Error("La respuesta del servidor no incluyó datos.");
  return body.data;
}

function bannerForGame(gameId: string, banners: AdminPlatformBannerOption[]) {
  return (
    banners.find((banner) => banner.gameId === gameId && banner.isDefault) ??
    banners.find((banner) => banner.gameId === gameId) ??
    banners.find((banner) => banner.gameId === null && banner.isDefault) ??
    banners[0]
  );
}

const bannerPositions: Array<{ value: BannerPosition; label: string }> = [
  { value: "center 20%", label: "Muy arriba" },
  { value: "center 32%", label: "Arriba" },
  { value: "center 42%", label: "Alto" },
  { value: "center", label: "Centro" },
  { value: "center 58%", label: "Bajo" },
  { value: "center 68%", label: "Abajo" },
  { value: "center 80%", label: "Muy abajo" },
  { value: "left center", label: "Izquierda" },
  { value: "right center", label: "Derecha" },
];

function normalizeBannerPosition(value?: string): BannerPosition {
  if (bannerPositions.some((position) => position.value === value)) return value as BannerPosition;
  if (value === "top") return "center 20%";
  if (value === "bottom") return "center 80%";
  if (value === "left") return "left center";
  if (value === "right") return "right center";
  return "center";
}

function bannerToneForGame(gameSlug?: string) {
  if (gameSlug === "one-piece-tcg") return "blue";
  if (gameSlug === "pokemon-tcg") return "amber";
  if (gameSlug === "yugioh") return "violet";
  return "rose";
}

export function EventForm({
  branches,
  customBanners,
  event,
  games,
  platformBanners,
  store,
}: {
  branches: BranchSummary[];
  customBanners: AdminStoreMediaAsset[];
  event?: EventSummary;
  games: AdminGameOption[];
  platformBanners: AdminPlatformBannerOption[];
  store: StoreSummary;
}) {
  const router = useRouter();
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.status === "active"),
    [branches],
  );
  const initialGameId = games.find((game) => game.slug === event?.game.slug)?.id ?? games[0]?.id ?? "";
  const initialBannerId = event?.platformBannerId
    ?? bannerForGame(initialGameId, platformBanners)?.id
    ?? "";
  const initialCustomBannerId = event?.customBannerAssetId
    ?? customBanners[0]?.id
    ?? "";
  const initialLocationMode = event?.locationMode ?? (activeBranches.length ? "branch" : "online");
  const [selectedGameId, setSelectedGameId] = useState(initialGameId);
  const [bannerMode, setBannerMode] = useState<"platform" | "custom">(event?.bannerMode ?? "platform");
  const [selectedBannerId, setSelectedBannerId] = useState(initialBannerId);
  const [selectedCustomBannerId, setSelectedCustomBannerId] = useState(initialCustomBannerId);
  const [bannerPosition, setBannerPosition] = useState<BannerPosition>(
    normalizeBannerPosition(event?.bannerPosition),
  );
  const [locationMode, setLocationMode] = useState<LocationMode>(initialLocationMode);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(event?.registrationMode ?? "disabled");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedGame = games.find((game) => game.id === selectedGameId);
  const eligibleBanners = platformBanners.filter((banner) =>
    banner.gameId === selectedGameId || banner.gameId === null,
  );
  const selectedBanner = eligibleBanners.find((banner) => banner.id === selectedBannerId)
    ?? bannerForGame(selectedGameId, platformBanners);
  const selectedCustomBanner = customBanners.find((banner) => banner.id === selectedCustomBannerId)
    ?? customBanners[0];
  const activeBannerUrl = bannerMode === "custom" ? selectedCustomBanner?.publicUrl : selectedBanner?.bannerUrl;
  const activeBannerLabel = bannerMode === "custom"
    ? "Custom"
    : selectedGame?.name ?? "Juego";
  const isDraft = !event || event.status === "draft";

  function selectGame(gameId: string) {
    setSelectedGameId(gameId);
    setSelectedBannerId(bannerForGame(gameId, platformBanners)?.id ?? "");
  }

  function buildPayload(formData: FormData): EventPayload {
    if (!selectedGame) throw new Error("Selecciona un juego.");
    if (bannerMode === "platform" && !selectedBanner) {
      throw new Error("No hay un banner de plataforma activo para crear eventos.");
    }
    if (bannerMode === "custom" && !selectedCustomBanner) {
      throw new Error("Selecciona un banner custom activo.");
    }

    const startsAt = isoFromDateTimeLocal(formData.get("startsAt"));
    if (!startsAt) throw new Error("Ingresa una fecha y hora de inicio válida.");

    const endsAt = isoFromDateTimeLocal(formData.get("endsAt"));
    const entryFeeAmount = parseFeeAmount(formData.get("entryFeeAmount"));
    const externalRegistrationUrl = registrationMode === "external"
      ? trimOrNull(formData.get("externalRegistrationUrl"))
      : null;

    if (registrationMode === "external" && !externalRegistrationUrl) {
      throw new Error("Ingresa una URL externa para el registro.");
    }

    const payload: EventPayload = {
      gameId: selectedGame.id,
      otherGameName: selectedGame.slug === "otros" ? trimOrNull(formData.get("otherGameName")) : null,
      title: String(formData.get("title") ?? "").trim(),
      description: trimOrNull(formData.get("description")),
      formatName: trimOrNull(formData.get("formatName")),
      entryFeeAmount,
      entryFeeCurrency: entryFeeAmount == null ? null : String(formData.get("entryFeeCurrency") ?? "CLP"),
      registrationMode,
      externalRegistrationUrl,
      locationMode,
      bannerMode,
      platformBannerId: bannerMode === "platform" ? selectedBanner?.id ?? null : null,
      bannerPosition,
      customBannerAssetId: bannerMode === "custom" ? selectedCustomBanner?.id ?? null : null,
      startsAt,
      endsAt,
    };

    if (selectedGame.slug === "otros" && !payload.otherGameName) {
      throw new Error("Indica el nombre del juego cuando seleccionas Otros.");
    }

    if (locationMode === "branch") {
      const branchId = String(formData.get("branchId") ?? "");
      if (!branchId) throw new Error("Selecciona una sucursal activa.");

      return {
        ...payload,
        branchId,
        locationText: null,
        locationCity: null,
        locationRegion: null,
        locationCountryCode: null,
      };
    }

    if (locationMode === "online") {
      const locationText = trimOrNull(formData.get("locationText"));
      if (!locationText) throw new Error("Indica el enlace o plataforma del evento online.");

      return {
        ...payload,
        branchId: null,
        locationText,
        locationCity: null,
        locationRegion: null,
        locationCountryCode: null,
      };
    }

    const locationText = trimOrNull(formData.get("locationText"));
    const locationCity = trimOrNull(formData.get("locationCity"));
    if (!locationText || !locationCity) {
      throw new Error("Ingresa dirección y ciudad para la ubicación personalizada.");
    }

    return {
      ...payload,
      branchId: null,
      locationText,
      locationCity,
      locationRegion: trimOrNull(formData.get("locationRegion")),
      locationCountryCode: "CL",
    };
  }

  async function onSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(submitEvent.currentTarget);
      const payload = buildPayload(formData);
      const submitter = (submitEvent.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const shouldPublish = submitter?.value === "publish" && isDraft;
      const response = await fetch(
        event ? `/api/v1/events/${event.id}` : `/api/v1/stores/${store.id}/events`,
        {
          method: event ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const savedEvent = await readApiResponse<{ id: string }>(response);

      if (shouldPublish) {
        const publishResponse = await fetch(`/api/v1/events/${savedEvent.id}/publish`, { method: "POST" });
        await readApiResponse<{ id: string }>(publishResponse);
      }

      router.refresh();
      router.push(`/admin/stores/${store.id}/events`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos guardar el evento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-card form-grid" onSubmit={onSubmit}>
      <div className="form-section-heading">
        <div>
          <p className="eyebrow">Información pública</p>
          <h2>Datos del evento</h2>
        </div>
      </div>
      <div className="form-grid two">
        <Field label="Título">
          <input defaultValue={event?.title} name="title" placeholder="Liga local de One Piece" required />
        </Field>
        <Field label="Juego">
          <select
            name="gameId"
            onChange={(changeEvent) => selectGame(changeEvent.target.value)}
            required
            value={selectedGameId}
          >
            {games.map((game) => (
              <option key={game.id} value={game.id}>{game.name}</option>
            ))}
          </select>
        </Field>
      </div>
      {selectedGame?.slug === "otros" ? (
        <Field label="Nombre del juego">
          <input name="otherGameName" placeholder="Nombre visible del juego" required />
        </Field>
      ) : null}
      <Field label="Descripción">
        <textarea defaultValue={event?.description} name="description" placeholder="Información pública del evento" />
      </Field>
      <div className="form-grid two">
        <Field label="Formato">
          <input defaultValue={event?.formatName ?? ""} name="formatName" placeholder="Constructed, sealed, casual..." />
        </Field>
        <Field label="Tipo de banner">
          <select
            onChange={(changeEvent) => setBannerMode(changeEvent.target.value as "platform" | "custom")}
            value={bannerMode}
          >
            <option value="platform">Banner de plataforma</option>
            <option disabled={!customBanners.length} value="custom">Banner custom</option>
          </select>
        </Field>
      </div>
      {bannerMode === "platform" ? (
        <Field label="Banner de plataforma">
          <select
            disabled={!eligibleBanners.length}
            onChange={(changeEvent) => setSelectedBannerId(changeEvent.target.value)}
            value={selectedBanner?.id ?? ""}
          >
            {eligibleBanners.map((banner) => (
              <option key={banner.id} value={banner.id}>{banner.name}</option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Banner custom">
          <select
            disabled={!customBanners.length}
            onChange={(changeEvent) => setSelectedCustomBannerId(changeEvent.target.value)}
            value={selectedCustomBanner?.id ?? ""}
          >
            {customBanners.map((banner) => (
              <option key={banner.id} value={banner.id}>
                Banner {new Date(banner.createdAt).toLocaleDateString("es-CL")}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!customBanners.length ? (
        <p className="form-helper">
          Puedes subir banners reutilizables desde{" "}
          <Link className="text-link" href={`/admin/stores/${store.id}/banners`}>Banners custom</Link>.
        </p>
      ) : null}
      <div className="banner-editor">
        <div className="banner-preview-stack">
          <div
            className={`banner-preview tone-${bannerToneForGame(selectedGame?.slug)}${activeBannerUrl ? " has-image" : ""}`}
            style={activeBannerUrl
              ? {
                  "--preview-banner-image": `url("${activeBannerUrl}")`,
                  "--preview-banner-position": bannerPosition,
                } as CSSProperties
              : undefined}
          >
            <span>Tarjeta · {activeBannerLabel}</span>
          </div>
          <div
            className={`banner-strip-preview tone-${bannerToneForGame(selectedGame?.slug)}${activeBannerUrl ? " has-image" : ""}`}
            style={activeBannerUrl
              ? {
                  "--preview-banner-image": `url("${activeBannerUrl}")`,
                  "--preview-banner-position": bannerPosition,
                } as CSSProperties
              : undefined}
          >
            <span>Franja de agenda</span>
          </div>
        </div>
        <fieldset className="banner-position-picker">
          <legend>Enfoque</legend>
          <div>
            {bannerPositions.map((position) => (
              <button
                className={bannerPosition === position.value ? "selected" : undefined}
                key={position.value}
                onClick={() => setBannerPosition(position.value)}
                type="button"
              >
                {position.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="form-section-heading">
        <div>
          <p className="eyebrow">Calendario</p>
          <h2>Fecha y costo</h2>
        </div>
      </div>
      <div className="form-grid two">
        <Field label="Inicio">
          <input
            defaultValue={event
              ? formatDateTimeLocal(event.startsAt, event.timezone)
              : defaultDateTimeLocal()}
            name="startsAt"
            required
            type="datetime-local"
          />
        </Field>
        <Field label="Término" hint="Opcional. Debe ser posterior al inicio.">
          <input
            defaultValue={formatDateTimeLocal(event?.endsAt, event?.timezone ?? store.timezone)}
            name="endsAt"
            type="datetime-local"
          />
        </Field>
      </div>
      <div className="form-grid two">
        <Field label="Entrada">
          <input
            defaultValue={event?.entryFee?.amount ?? ""}
            min="0"
            name="entryFeeAmount"
            placeholder="0"
            step="100"
            type="number"
          />
        </Field>
        <Field label="Moneda">
          <select defaultValue={event?.entryFee?.currency ?? "CLP"} name="entryFeeCurrency">
            <option value="CLP">CLP</option>
            <option value="USD">USD</option>
          </select>
        </Field>
      </div>

      <div className="form-section-heading">
        <div>
          <p className="eyebrow">Operación</p>
          <h2>Ubicación y registro</h2>
        </div>
      </div>
      <div className="form-grid two">
        <Field label="Tipo de ubicación">
          <select
            onChange={(changeEvent) => setLocationMode(changeEvent.target.value as LocationMode)}
            value={locationMode}
          >
            <option disabled={!activeBranches.length} value="branch">Sucursal</option>
            <option value="custom">Ubicación personalizada</option>
            <option value="online">Online</option>
          </select>
        </Field>
        {locationMode === "branch" ? (
          <Field label="Sucursal">
            <select defaultValue={event?.branchId ?? activeBranches[0]?.id} name="branchId" required>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={locationMode === "online" ? "Enlace o plataforma" : "Dirección"}>
            <input
              defaultValue={event?.locationMode === locationMode ? event.locationLabel : ""}
              name="locationText"
              placeholder={locationMode === "online" ? "https://discord.gg/..." : "Dirección del evento"}
              required
            />
          </Field>
        )}
      </div>
      {locationMode === "custom" ? (
        <div className="form-grid two">
          <Field label="Ciudad">
            <input defaultValue={event?.city ?? ""} name="locationCity" placeholder="Concepción" required />
          </Field>
          <Field label="Región">
            <input name="locationRegion" placeholder="Biobío" />
          </Field>
        </div>
      ) : null}
      <div className="form-grid two">
        <Field label="Modo de registro" hint="Stage 1 permite deshabilitado o externo.">
          <select
            onChange={(changeEvent) => setRegistrationMode(changeEvent.target.value as RegistrationMode)}
            value={registrationMode}
          >
            <option value="disabled">Deshabilitado</option>
            <option value="external">Externo</option>
          </select>
        </Field>
        {registrationMode === "external" ? (
          <Field label="URL externa">
            <input
              defaultValue={event?.externalRegistrationUrl ?? ""}
              name="externalRegistrationUrl"
              placeholder="https://..."
              required
              type="url"
            />
          </Field>
        ) : <div />}
      </div>

      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <div className="button-row">
        <button className="button button-secondary" disabled={isSubmitting || (bannerMode === "platform" ? !selectedBanner : !selectedCustomBanner)} type="submit" value="draft">
          {isSubmitting ? "Guardando..." : event ? "Guardar cambios" : "Guardar borrador"}
        </button>
        {isDraft ? (
          <button className="button button-primary" disabled={isSubmitting || (bannerMode === "platform" ? !selectedBanner : !selectedCustomBanner)} type="submit" value="publish">
            {isSubmitting ? "Publicando..." : "Publicar evento"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
