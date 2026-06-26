"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Field, StatusBadge } from "@/components/frontend";
import type {
  AdminGameOption,
  AdminPlatformBannerOption,
  AdminStoreMediaAsset,
} from "@/lib/frontend/admin-data";
import type {
  BranchSummary,
  EventSeriesSummary,
  LocationMode,
  RegistrationMode,
  StoreSummary,
} from "@/lib/frontend/domain";

const weekdays = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

type BannerPosition = "center";

type SeriesPayload = {
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
  weekdays: number[];
  localStartTime: string;
  durationMinutes: number | null;
  timezone: string;
  startsOn: string;
  endsOn?: string | null;
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

function parseFeeAmount(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

function defaultStartDate() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operacion.");
  }

  if (!body.data) throw new Error("La respuesta del servidor no incluyo datos.");
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

export function SeriesForm({
  branches,
  customBanners,
  games,
  platformBanners,
  series,
  store,
}: {
  branches: BranchSummary[];
  customBanners: AdminStoreMediaAsset[];
  games: AdminGameOption[];
  platformBanners: AdminPlatformBannerOption[];
  series?: EventSeriesSummary;
  store: StoreSummary;
}) {
  const router = useRouter();
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.status === "active"),
    [branches],
  );
  const initialGameId = games.find((game) => game.slug === series?.game.slug)?.id ?? games[0]?.id ?? "";
  const initialBannerId = series?.platformBannerId
    ?? bannerForGame(initialGameId, platformBanners)?.id
    ?? "";
  const initialCustomBannerId = series?.customBannerAssetId
    ?? customBanners[0]?.id
    ?? "";
  const initialLocationMode = series?.locationMode ?? (activeBranches.length ? "branch" : "online");
  const [selectedDays, setSelectedDays] = useState<number[]>(series?.weekdays ?? [5]);
  const [startTime, setStartTime] = useState(series?.localStartTime ?? "19:00");
  const [selectedGameId, setSelectedGameId] = useState(initialGameId);
  const [bannerMode, setBannerMode] = useState<"platform" | "custom">(series?.bannerMode ?? "platform");
  const [selectedBannerId, setSelectedBannerId] = useState(initialBannerId);
  const [selectedCustomBannerId, setSelectedCustomBannerId] = useState(initialCustomBannerId);
  const [locationMode, setLocationMode] = useState<LocationMode>(initialLocationMode);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(series?.registrationMode ?? "disabled");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schedule = useMemo(
    () => [...selectedDays]
      .sort((left, right) => left - right)
      .map((day) => weekdays.find((weekday) => weekday.value === day)?.label)
      .join(", "),
    [selectedDays],
  );
  const selectedGame = games.find((game) => game.id === selectedGameId);
  const eligibleBanners = platformBanners.filter((banner) =>
    banner.gameId === selectedGameId || banner.gameId === null,
  );
  const selectedBanner = eligibleBanners.find((banner) => banner.id === selectedBannerId)
    ?? bannerForGame(selectedGameId, platformBanners);
  const selectedCustomBanner = customBanners.find((banner) => banner.id === selectedCustomBannerId)
    ?? customBanners[0];
  const isDraft = !series || series.status === "draft";

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  function selectGame(gameId: string) {
    setSelectedGameId(gameId);
    setSelectedBannerId(bannerForGame(gameId, platformBanners)?.id ?? "");
  }

  function buildPayload(formData: FormData): SeriesPayload {
    if (!selectedGame) throw new Error("Selecciona un juego.");
    if (!selectedDays.length) throw new Error("Selecciona al menos un dia de la semana.");
    if (bannerMode === "platform" && !selectedBanner) {
      throw new Error("No hay un banner de plataforma activo para crear series.");
    }
    if (bannerMode === "custom" && !selectedCustomBanner) {
      throw new Error("Selecciona un banner custom activo.");
    }

    const entryFeeAmount = parseFeeAmount(formData.get("entryFeeAmount"));
    const externalRegistrationUrl = registrationMode === "external"
      ? trimOrNull(formData.get("externalRegistrationUrl"))
      : null;

    if (registrationMode === "external" && !externalRegistrationUrl) {
      throw new Error("Ingresa una URL externa para el registro.");
    }

    const payload: SeriesPayload = {
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
      bannerPosition: "center",
      customBannerAssetId: bannerMode === "custom" ? selectedCustomBanner?.id ?? null : null,
      weekdays: [...selectedDays].sort((left, right) => left - right),
      localStartTime: startTime,
      durationMinutes: Number(formData.get("durationMinutes")),
      timezone: store.timezone,
      startsOn: String(formData.get("startsOn") ?? "").trim(),
      endsOn: trimOrNull(formData.get("endsOn")),
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
      throw new Error("Ingresa direccion y ciudad para la ubicacion personalizada.");
    }

    return {
      ...payload,
      branchId: null,
      locationText,
      locationCity,
      locationRegion: trimOrNull(formData.get("locationRegion")),
      locationCountryCode: series?.locationCountryCode ?? "CL",
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
      const shouldActivate = submitter?.value === "activate" && isDraft;
      const response = await fetch(
        series ? `/api/v1/series/${series.id}` : `/api/v1/stores/${store.id}/series`,
        {
          method: series ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const savedSeries = await readApiResponse<{ id: string }>(response);

      if (shouldActivate) {
        const activateResponse = await fetch(`/api/v1/series/${savedSeries.id}/activate`, { method: "POST" });
        await readApiResponse<{ id: string }>(activateResponse);
      }

      router.refresh();
      router.push(`/admin/stores/${store.id}/series`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos guardar la serie.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="series-form-layout">
      <form className="form-card form-grid" onSubmit={onSubmit}>
        <div className="form-section-heading">
          <div><p className="eyebrow">Informacion publica</p><h2>Plantilla del evento</h2></div>
        </div>
        <div className="form-grid two">
          <Field label="Titulo">
            <input defaultValue={series?.title} name="title" placeholder="Friday Night Magic" required />
          </Field>
          <Field label="Juego">
            <select
              name="gameId"
              onChange={(event) => selectGame(event.target.value)}
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
            <input defaultValue={series?.otherGameName ?? ""} name="otherGameName" placeholder="Nombre visible del juego" required />
          </Field>
        ) : null}
        <Field label="Descripcion">
          <textarea defaultValue={series?.description} name="description" placeholder="Informacion visible en cada ocurrencia" />
        </Field>
        <div className="form-grid two">
          <Field label="Formato">
            <input defaultValue={series?.formatName ?? ""} name="formatName" placeholder="Standard, Modern..." />
          </Field>
          <Field label="Zona horaria" hint="La recurrencia se evalua siempre en hora local.">
            <input defaultValue={store.timezone} readOnly />
          </Field>
        </div>
        <div className="form-grid two">
          <Field label="Tipo de banner">
            <select
              onChange={(event) => setBannerMode(event.target.value as "platform" | "custom")}
              value={bannerMode}
            >
              <option value="platform">Banner de plataforma</option>
              <option disabled={!customBanners.length} value="custom">Banner custom</option>
            </select>
          </Field>
          {bannerMode === "platform" ? (
            <Field label="Banner de plataforma">
              <select
                disabled={!eligibleBanners.length}
                onChange={(event) => setSelectedBannerId(event.target.value)}
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
                onChange={(event) => setSelectedCustomBannerId(event.target.value)}
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
        </div>
        {!customBanners.length ? (
          <p className="form-helper">
            Puedes subir banners reutilizables desde{" "}
            <Link className="text-link" href={`/admin/stores/${store.id}/banners`}>Banners custom</Link>.
          </p>
        ) : null}

        <div className="form-section-heading">
          <div><p className="eyebrow">Recurrencia semanal</p><h2>Dias y horario</h2></div>
        </div>
        <fieldset className="weekday-fieldset">
          <legend>Dias de la semana</legend>
          <div className="weekday-picker">
            {weekdays.map((day) => (
              <label className={selectedDays.includes(day.value) ? "selected" : undefined} key={day.value}>
                <input
                  checked={selectedDays.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                  type="checkbox"
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
          {!selectedDays.length ? <small>Selecciona al menos un dia.</small> : null}
        </fieldset>
        <div className="form-grid two">
          <Field label="Hora local de inicio">
            <input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </Field>
          <Field label="Duracion">
            <select defaultValue={String(series?.durationMinutes ?? 180)} name="durationMinutes">
              <option value="120">2 horas</option>
              <option value="180">3 horas</option>
              <option value="240">4 horas</option>
              <option value="360">6 horas</option>
            </select>
          </Field>
        </div>
        <div className="form-grid two">
          <Field label="Comienza el">
            <input defaultValue={series?.startsOn ?? defaultStartDate()} name="startsOn" required type="date" />
          </Field>
          <Field label="Termina el" hint="Opcional. Sin fecha, la serie continua hasta que se finalice.">
            <input defaultValue={series?.endsOn ?? ""} name="endsOn" type="date" />
          </Field>
        </div>

        <div className="form-section-heading">
          <div><p className="eyebrow">Operacion</p><h2>Ubicacion y registro</h2></div>
        </div>
        <div className="form-grid two">
          <Field label="Tipo de ubicacion">
            <select value={locationMode} onChange={(event) => setLocationMode(event.target.value as LocationMode)}>
              <option disabled={!activeBranches.length} value="branch">Sucursal</option>
              <option value="custom">Ubicacion personalizada</option>
              <option value="online">Online</option>
            </select>
          </Field>
          {locationMode === "branch" ? (
            <Field label="Sucursal">
              <select defaultValue={series?.branchId ?? activeBranches[0]?.id} name="branchId" required>
                {activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label={locationMode === "online" ? "Enlace o plataforma" : "Direccion"}>
              <input
                defaultValue={series?.locationMode === locationMode ? series.locationLabel : ""}
                name="locationText"
                placeholder={locationMode === "online" ? "Discord de la tienda" : "Direccion del evento"}
                required
              />
            </Field>
          )}
        </div>
        {locationMode === "custom" ? (
          <div className="form-grid two">
            <Field label="Ciudad">
              <input defaultValue={series?.locationCity ?? ""} name="locationCity" placeholder="Concepcion" required />
            </Field>
            <Field label="Region">
              <input defaultValue={series?.locationRegion ?? ""} name="locationRegion" placeholder="Biobio" />
            </Field>
          </div>
        ) : null}
        <div className="form-grid two">
          <Field label="Entrada">
            <input
              defaultValue={series?.entryFee?.amount ?? ""}
              min="0"
              name="entryFeeAmount"
              placeholder="0"
              step="100"
              type="number"
            />
          </Field>
          <Field label="Moneda">
            <select defaultValue={series?.entryFee?.currency ?? "CLP"} name="entryFeeCurrency">
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </div>
        <div className="form-grid two">
          <Field label="Modo de registro" hint="Puedes deshabilitar el registro o enlazar una inscripción externa.">
            <select value={registrationMode} onChange={(event) => setRegistrationMode(event.target.value as RegistrationMode)}>
              <option value="disabled">Deshabilitado</option>
              <option value="external">Externo</option>
            </select>
          </Field>
          {registrationMode === "external" ? (
            <Field label="URL externa">
              <input
                defaultValue={series?.externalRegistrationUrl ?? ""}
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
          <button
            className="button button-secondary"
            disabled={isSubmitting || (bannerMode === "platform" ? !selectedBanner : !selectedCustomBanner)}
            type="submit"
            value="draft"
          >
            {isSubmitting ? "Guardando..." : series ? "Guardar cambios futuros" : "Guardar borrador"}
          </button>
          {isDraft ? (
            <button
              className="button button-primary"
              disabled={isSubmitting || !selectedDays.length || (bannerMode === "platform" ? !selectedBanner : !selectedCustomBanner)}
              type="submit"
              value="activate"
            >
              {isSubmitting ? "Activando..." : "Activar serie"}
            </button>
          ) : null}
        </div>
      </form>

      <aside className="series-preview">
        <div className="panel-card">
          <p className="eyebrow">Resumen de generacion</p>
          <StatusBadge status={series?.status ?? "draft"} />
          <h2>{series?.title ?? "Nueva serie semanal"}</h2>
          <p className="series-preview-schedule">{schedule || "Selecciona dias"} - {startTime}</p>
          <p>Zona horaria: {store.timezone}</p>
          <div className="series-rule-note">
            Al activar, se publican las ocurrencias elegibles restantes de esta semana. Cada domingo se genera la semana siguiente.
          </div>
        </div>
        <div className="panel-card">
          <p className="eyebrow">Importante</p>
          <p>Editar esta plantilla afecta fechas futuras aun no generadas. Los eventos ya publicados se administran individualmente.</p>
        </div>
      </aside>
    </div>
  );
}
