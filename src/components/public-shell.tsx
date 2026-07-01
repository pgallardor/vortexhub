import Link from "next/link";
import type { ReactNode } from "react";
import { PublicAccountMenu } from "@/components/public-account-menu";
import { Brand } from "@/components/frontend";
import { PublicNavigation } from "@/components/public-navigation";
import { getPublicSessionSummary } from "@/lib/auth/public-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PublicHeaderActionsProps = {
  session: Awaited<ReturnType<typeof getPublicSessionSummary>>;
};

function PublicHeaderActions({ session }: PublicHeaderActionsProps) {
  if (session) {
    return (
      <div className="header-actions header-actions-authenticated">
        <PublicAccountMenu session={session} />
      </div>
    );
  }

  return (
    <div className="header-actions">
      <Link className="button button-secondary" href="/auth/login?mode=player&redirectTo=/player/me">Jugador</Link>
      <Link className="button button-secondary" href="/auth/login?mode=store&redirectTo=/admin">Tienda</Link>
    </div>
  );
}

export async function PublicShell({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const session = await getPublicSessionSummary(supabase);

  return (
    <div className="site-shell">
      <header className="public-header">
        <div className="page-container header-inner">
          <Brand />
          <PublicNavigation />
          <PublicHeaderActions session={session} />
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
