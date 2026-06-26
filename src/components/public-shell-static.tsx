import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/frontend";
import { PublicNavigation } from "@/components/public-navigation";

export function PublicShellStatic({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="public-header">
        <div className="page-container header-inner">
          <Brand />
          <PublicNavigation />
          <div className="header-actions">
            <Link className="button button-secondary" href="/auth/login">Acceso tienda</Link>
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
