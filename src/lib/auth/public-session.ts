import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getOptionalUser } from "@/lib/auth/optional-user";

type AccountSummaryRow = {
  display_name: string | null;
  status: string | null;
};

type IdentityRow = {
  id: string;
};

export type PublicSessionSummary = {
  user: User;
  displayName: string;
  email: string | null;
  accountStatus: string | null;
  hasPlayerProfile: boolean;
  hasStoreMembership: boolean;
};

async function hasSingleRow(
  query: PromiseLike<{ data: IdentityRow | null; error: unknown }>,
) {
  const { data, error } = await query;
  return !error && Boolean(data);
}

export async function getPublicSessionSummary(
  client: SupabaseClient,
): Promise<PublicSessionSummary | null> {
  const user = await getOptionalUser(client);
  if (!user) return null;

  const accountQuery = client
    .from("user_accounts")
    .select("display_name,status")
    .eq("id", user.id)
    .maybeSingle<AccountSummaryRow>();

  const playerProfileQuery = client
    .from("player_profiles")
    .select("id")
    .eq("user_account_id", user.id)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<IdentityRow>();

  const storeMembershipQuery = client
    .from("store_memberships")
    .select("id")
    .eq("user_account_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<IdentityRow>();

  const [accountResult, hasPlayerProfile, hasStoreMembership] = await Promise.all([
    accountQuery,
    hasSingleRow(playerProfileQuery),
    hasSingleRow(storeMembershipQuery),
  ]);

  const account = accountResult.error ? null : accountResult.data;
  const email = user.email ?? null;

  return {
    user,
    displayName: account?.display_name ?? email ?? "Cuenta VortexHub",
    email,
    accountStatus: account?.status ?? null,
    hasPlayerProfile,
    hasStoreMembership,
  };
}
