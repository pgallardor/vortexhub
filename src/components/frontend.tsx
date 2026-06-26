import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { PublicNavigation } from "@/components/public-navigation";
import type { StoreSummary } from "@/lib/frontend/domain";

export function Brand() {
  return (
    <Link className="brand" href="/">
      <Image
        alt=""
        aria-hidden="true"
        className="brand-mark"
        height={30}
        priority
        src="/brand/vortex-logo.png"
        width={24}
      />
      <span>VORTEXHUB</span>
    </Link>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="public-header">
        <div className="page-container header-inner">
          <Brand />
          <PublicNavigation />
          <div className="header-actions">
            <Link className="text-link" href="/auth/login">Acceso tiendas</Link>
            <Link className="button button-secondary" href="/admin">Administrar tienda</Link>
          </div>
        </div>
      </header>
      <div className="site-content">{children}</div>
      <footer className="public-footer">
        <div className="page-container footer-inner">
          <Brand />
          <span>Calendarios compartibles para comunidades TCG.</span>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="lead">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <Link className="panel-card store-card" href={`/stores/${store.slug}`}>
      <div className="store-card-heading">
        <div className="store-card-identity">
          <span className="store-logo-frame">
            <Image
              alt={`Logo de ${store.name}`}
              className="store-logo"
              height={72}
              src={store.logoUrl ?? "/demo/store-logo-placeholder.png"}
              width={72}
            />
          </span>
          <div>
            <span className="eyebrow">{store.cityLabel}</span>
            <h2>{store.name}</h2>
          </div>
        </div>
      </div>
      <p>{store.description}</p>
      <span className="card-link">Ver calendario <span aria-hidden="true">→</span></span>
    </Link>
  );
}

const statusPresentation: Record<string, { label: string; tone: string }> = {
  active: { label: "Activo", tone: "success" },
  published: { label: "Publicado", tone: "success" },
  completed: { label: "Completado", tone: "neutral" },
  pending: { label: "Pendiente", tone: "warning" },
  draft: { label: "Borrador", tone: "warning" },
  suspended: { label: "Suspendido", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "danger" },
  closed: { label: "Cerrado", tone: "neutral" },
  inactive: { label: "Inactivo", tone: "neutral" },
  ended: { label: "Finalizada", tone: "neutral" },
  publica: { label: "Publica", tone: "success" },
  oculta: { label: "Oculta", tone: "warning" },
  "sin publicar": { label: "Sin publicar", tone: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const presentation = statusPresentation[status.toLowerCase()];

  return (
    <span className={`status-badge status-${presentation?.tone ?? "info"}`}>
      <span className="status-dot" aria-hidden="true" />
      {presentation?.label ?? status}
    </span>
  );
}

export function LaterStageNotice({ feature }: { feature: string }) {
  return (
    <section className="notice-card">
      <span className="eyebrow">Experiencia de jugador</span>
      <h1>{feature} estará disponible próximamente</h1>
      <p>
        Estamos preparando la identidad de jugador y el QR personal para que puedas usarlos en
        eventos sin crear perfiles públicos ni compartir datos innecesarios.
      </p>
      <div className="button-row">
        <Link className="button button-primary" href="/#events">Explorar eventos</Link>
        <Link className="button button-secondary" href="/stores">Ver tiendas</Link>
      </div>
    </section>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
