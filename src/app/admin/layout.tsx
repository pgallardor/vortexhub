import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { canUseStoreAdministration } from "@/lib/auth/account-requirements";
import { getAdminStores } from "@/lib/frontend/admin-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?redirectTo=/admin");
  if (!(await canUseStoreAdministration(supabase, user.id))) {
    redirect("/auth/onboarding?redirectTo=/admin");
  }

  const stores = await getAdminStores();
  const defaultStoreId = stores[0]?.store.id;

  return <AdminShell defaultStoreId={defaultStoreId}>{children}</AdminShell>;
}
