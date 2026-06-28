"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Brand, StatusBadge } from "@/components/frontend";
import type { StoreMembershipRole, StoreMembershipScope, StoreSummary } from "@/lib/frontend/domain";

function navClassName(pathname: string, href: string) {
  return pathname === href ? "active" : undefined;
}

function storeInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "T";
}

function StoreMark({ store }: { store: StoreSummary }) {
  return store.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" src={store.logoUrl} />
  ) : (
    <span>{storeInitial(store.name)}</span>
  );
}

type AdminViewer = {
  displayName: string;
  email: string | null;
};

function roleLabel(role?: StoreMembershipRole, scope?: StoreMembershipScope) {
  if (role === "owner") return "Dueño";
  if (role === "admin") return scope === "branches" ? "Admin sucursales" : "Admin tienda";
  if (role === "staff") return scope === "branches" ? "Staff sucursales" : "Staff tienda";
  return "Cuenta activa";
}

function SessionSummary({
  activeStore,
  viewer,
}: {
  activeStore?: StoreSummary;
  viewer: AdminViewer;
}) {
  const membership = activeStore?.viewerMembership;

  return (
    <div className="admin-session-summary">
      <p>Sesión</p>
      <strong>{viewer.displayName}</strong>
      {viewer.email ? <span>{viewer.email}</span> : null}
      <small>{roleLabel(membership?.role, membership?.scope)}</small>
    </div>
  );
}

export function AdminShell({
  children,
  defaultStoreId,
  stores = [],
  viewer,
}: {
  children: ReactNode;
  defaultStoreId?: string;
  stores?: StoreSummary[];
  viewer: AdminViewer;
}) {
  const pathname = usePathname();
  const storeId = pathname.match(/^\/admin\/stores\/([^/]+)/)?.[1] ?? defaultStoreId;
  const isCalendarRoute = pathname.startsWith(`/admin/stores/${storeId}/calendar`);
  const hasStore = Boolean(storeId);
  const activeStore = stores.find((store) => store.id === storeId);
  const canOpenTeam = ["owner", "admin"].includes(activeStore?.viewerMembership?.role ?? "");
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const storeSwitcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!storeSwitcherRef.current?.contains(event.target as Node)) {
        setIsStoreMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    setIsStoreMenuOpen(false);
  }, [pathname]);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand />
        {activeStore ? (
          <div className={`admin-store-switcher${isStoreMenuOpen ? " open" : ""}`} ref={storeSwitcherRef}>
            <button
              aria-expanded={isStoreMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsStoreMenuOpen((current) => !current)}
              type="button"
            >
              <span className="admin-store-mark"><StoreMark store={activeStore} /></span>
              <span className="admin-store-switcher-copy">
                <strong>{activeStore.name}</strong>
                <small>{activeStore.cityLabel}</small>
              </span>
            </button>
            {isStoreMenuOpen ? (
              <div className="admin-store-menu" role="menu">
                {stores.map((store) => (
                  <Link
                    className={store.id === activeStore.id ? "selected" : undefined}
                    href={`/admin/stores/${store.id}`}
                    key={store.id}
                    role="menuitem"
                  >
                    <span className="admin-store-mark"><StoreMark store={store} /></span>
                    <span className="admin-store-option-copy">
                      <strong>{store.name}</strong>
                      <small>{store.cityLabel}</small>
                    </span>
                    <StatusBadge status={store.status} />
                  </Link>
                ))}
                <Link className="admin-store-menu-footer" href="/admin/stores" role="menuitem">Ver todas las tiendas</Link>
              </div>
            ) : null}
          </div>
        ) : null}
        <nav className="admin-nav" aria-label="Navegación administrativa">
          {hasStore ? (
            <>
              <Link className={navClassName(pathname, `/admin/stores/${storeId}`)} href={`/admin/stores/${storeId}`}>Vista general</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/calendar`) ? "active" : undefined} href={`/admin/stores/${storeId}/calendar`}>Calendario</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/events`) ? "active" : undefined} href={`/admin/stores/${storeId}/events`}>Eventos</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/series`) ? "active" : undefined} href={`/admin/stores/${storeId}/series`}>Series</Link>
              <Link className={navClassName(pathname, `/admin/stores/${storeId}/branches`)} href={`/admin/stores/${storeId}/branches`}>Sucursales</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/banners`) ? "active" : undefined} href={`/admin/stores/${storeId}/banners`}>Banners</Link>
              {canOpenTeam ? (
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/team`) ? "active" : undefined} href={`/admin/stores/${storeId}/team`}>Equipo</Link>
              ) : null}
            </>
          ) : (
            <>
              <Link className={navClassName(pathname, "/admin/stores")} href="/admin/stores">Mis tiendas</Link>
              <Link className={navClassName(pathname, "/admin")} href="/admin">Panel global</Link>
            </>
          )}
        </nav>
        <div className="admin-session-area">
          <SessionSummary activeStore={activeStore} viewer={viewer} />
        </div>
        <form action="/auth/logout" method="post" className="admin-logout-form">
          <button className="admin-logout-button" type="submit">Cerrar sesión</button>
        </form>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-header">
          <div className="admin-mobile-topbar">
            <Brand />
            <div className="admin-mobile-session">
              <SessionSummary activeStore={activeStore} viewer={viewer} />
              <form action="/auth/logout" method="post">
                <button className="admin-logout-button" type="submit">Cerrar sesión</button>
              </form>
            </div>
          </div>
          <nav className="admin-mobile-nav" aria-label="Navegación administrativa móvil">
            {hasStore ? (
              <>
                <Link className={navClassName(pathname, `/admin/stores/${storeId}`)} href={`/admin/stores/${storeId}`}>Tienda</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/calendar`) ? "active" : undefined} href={`/admin/stores/${storeId}/calendar`}>Calendario</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/events`) ? "active" : undefined} href={`/admin/stores/${storeId}/events`}>Eventos</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/series`) ? "active" : undefined} href={`/admin/stores/${storeId}/series`}>Series</Link>
                <Link className={navClassName(pathname, `/admin/stores/${storeId}/branches`)} href={`/admin/stores/${storeId}/branches`}>Sucursales</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/banners`) ? "active" : undefined} href={`/admin/stores/${storeId}/banners`}>Banners</Link>
                {canOpenTeam ? (
                  <Link className={pathname.startsWith(`/admin/stores/${storeId}/team`) ? "active" : undefined} href={`/admin/stores/${storeId}/team`}>Equipo</Link>
                ) : null}
                <Link className={navClassName(pathname, "/admin/stores")} href="/admin/stores">Tiendas</Link>
              </>
            ) : (
              <>
                <Link className={navClassName(pathname, "/admin/stores")} href="/admin/stores">Mis tiendas</Link>
                <Link className={navClassName(pathname, "/admin")} href="/admin">Panel global</Link>
              </>
            )}
          </nav>
        </header>
        <main className={`admin-content${isCalendarRoute ? " admin-content-wide" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
