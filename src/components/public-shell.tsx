import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/frontend";
import { PublicNavigation } from "@/components/public-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function PublicHeaderActions() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="header-actions">
      {user ? (
        <Link className="button button-secondary" href="/admin">Administrar tienda</Link>
      ) : (
        <Link className="button button-secondary" href="/auth/login">Acceso tienda</Link>
      )}
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="public-header">
        <div className="page-container header-inner">
          <Brand />
          <PublicNavigation />
          <PublicHeaderActions />
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
