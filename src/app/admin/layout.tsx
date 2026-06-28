import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { canUseStoreAdministration } from "@/lib/auth/account-requirements";
import { getAdminStores } from "@/lib/frontend/admin-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AccountIdentityRow = {
  display_name: string | null;
};

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?redirectTo=/admin");
  if (!(await canUseStoreAdministration(supabase, user.id))) {
    redirect("/auth/onboarding?redirectTo=/admin");
  }

  const { data: account } = await supabase
    .from("user_accounts")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle<AccountIdentityRow>();

  const stores = await getAdminStores();
  const defaultStoreId = stores[0]?.store.id;
  const viewer = {
    displayName: account?.display_name ?? user.email ?? "Usuario de tienda",
    email: user.email ?? null,
  };

  return (
    <AdminShell defaultStoreId={defaultStoreId} stores={stores.map((overview) => overview.store)} viewer={viewer}>
      {children}
    </AdminShell>
  );
}
