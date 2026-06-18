"use client";

import { useMemo, useState } from "react";
import { Field, StatusBadge } from "@/components/frontend";
import type { BranchSummary, EventSeriesSummary, StoreSummary } from "@/lib/frontend/domain";

const weekdays = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

export function SeriesForm({
  store,
  branches,
  series,
}: {
  store: StoreSummary;
  branches: BranchSummary[];
  series?: EventSeriesSummary;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>(series?.weekdays ?? [5]);
  const [startTime, setStartTime] = useState(series?.localStartTime ?? "19:00");
  const [locationMode, setLocationMode] = useState(series?.locationMode ?? "branch");
  const [registrationMode, setRegistrationMode] = useState(series?.registrationMode ?? "disabled");

  const schedule = useMemo(
    () => selectedDays
      .sort((left, right) => left - right)
      .map((day) => weekdays.find((weekday) => weekday.value === day)?.label)
      .join(", "),
    [selectedDays],
  );

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    );
  }

  return (
    <div className="series-form-layout">
      <form className="form-card form-grid">
        <div className="form-section-heading">
          <div><p className="eyebrow">Información pública</p><h2>Plantilla del evento</h2></div>
        </div>
        <div className="form-grid two">
          <Field label="Título"><input defaultValue={series?.title} placeholder="Friday Night Magic" /></Field>
          <Field label="Juego">
            <select defaultValue={series?.game.slug ?? "magic-the-gathering"}>
              <option value="magic-the-gathering">Magic: The Gathering</option>
              <option value="pokemon-tcg">Pokémon TCG</option>
              <option value="miscelaneo">Miscelaneo</option>
              <option value="otros">Otros</option>
            </select>
          </Field>
        </div>
        <Field label="Descripción"><textarea defaultValue={series?.description} placeholder="Información visible en cada ocurrencia" /></Field>
        <div className="form-grid two">
          <Field label="Formato"><input defaultValue={series?.formatName ?? ""} placeholder="Standard, Modern..." /></Field>
          <Field label="Zona horaria" hint="La recurrencia se evalúa siempre en hora local.">
            <input defaultValue={series?.timezone ?? store.timezone} readOnly />
          </Field>
        </div>

        <div className="form-section-heading">
          <div><p className="eyebrow">Recurrencia semanal</p><h2>Días y horario</h2></div>
        </div>
        <fieldset className="weekday-fieldset">
          <legend>Días de la semana</legend>
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
          {!selectedDays.length ? <small>Selecciona al menos un día.</small> : null}
        </fieldset>
        <div className="form-grid two">
          <Field label="Hora local de inicio"><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
          <Field label="Duración"><select defaultValue={String(series?.durationMinutes ?? 180)}><option value="120">2 horas</option><option value="180">3 horas</option><option value="240">4 horas</option><option value="360">6 horas</option></select></Field>
        </div>
        <div className="form-grid two">
          <Field label="Comienza el"><input defaultValue={series?.startsOn ?? "2026-11-01"} type="date" /></Field>
          <Field label="Termina el" hint="Opcional. Sin fecha, la serie continúa hasta que se finalice."><input defaultValue={series?.endsOn ?? ""} type="date" /></Field>
        </div>

        <div className="form-section-heading">
          <div><p className="eyebrow">Operación</p><h2>Ubicación y registro</h2></div>
        </div>
        <div className="form-grid two">
          <Field label="Tipo de ubicación">
            <select value={locationMode} onChange={(event) => setLocationMode(event.target.value as EventSeriesSummary["locationMode"])}>
              <option value="branch">Sucursal</option><option value="custom">Ubicación personalizada</option><option value="online">Online</option>
            </select>
          </Field>
          {locationMode === "branch" ? (
            <Field label="Sucursal"><select defaultValue={series?.branchId ?? branches[0]?.id}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
          ) : (
            <Field label={locationMode === "online" ? "Enlace o plataforma" : "Dirección"}><input defaultValue={series?.locationLabel ?? ""} placeholder={locationMode === "online" ? "Discord de la tienda" : "Dirección del evento"} /></Field>
          )}
        </div>
        <div className="form-grid two">
          <Field label="Modo de registro" hint="Stage 1 permite deshabilitado o externo.">
            <select value={registrationMode} onChange={(event) => setRegistrationMode(event.target.value as EventSeriesSummary["registrationMode"])}>
              <option value="disabled">Deshabilitado</option><option value="external">Externo</option>
            </select>
          </Field>
          {registrationMode === "external" ? <Field label="URL externa"><input defaultValue={series?.externalRegistrationUrl ?? ""} placeholder="https://..." type="url" /></Field> : <div />}
        </div>
        <div className="button-row">
          <button className="button button-secondary" type="button">Guardar borrador</button>
          <button className="button button-primary" disabled={!selectedDays.length} type="button">
            {series?.status === "active" ? "Guardar cambios futuros" : "Activar serie"}
          </button>
        </div>
      </form>

      <aside className="series-preview">
        <div className="panel-card">
          <p className="eyebrow">Resumen de generación</p>
          <StatusBadge status={series?.status ?? "draft"} />
          <h2>{series?.title ?? "Nueva serie semanal"}</h2>
          <p className="series-preview-schedule">{schedule || "Selecciona días"} · {startTime}</p>
          <p>Zona horaria: {series?.timezone ?? store.timezone}</p>
          <div className="series-rule-note">
            Al activar, se publican las ocurrencias elegibles restantes de esta semana. Cada domingo se genera la semana siguiente.
          </div>
        </div>
        <div className="panel-card">
          <p className="eyebrow">Importante</p>
          <p>Editar esta plantilla afecta fechas futuras aún no generadas. Los eventos ya publicados se administran individualmente.</p>
        </div>
      </aside>
    </div>
  );
}
