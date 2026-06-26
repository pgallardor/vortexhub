import type { SupabaseClient } from "@supabase/supabase-js";

type AccountRequirementRow = {
  status: string;
};

type LegalDocumentRow = {
  id: string;
};

type LegalAcceptanceRow = {
  id: string;
};

export async function hasCurrentMinimumAgeAcceptance(
  client: SupabaseClient,
  userAccountId: string,
) {
  const { data: legalDocument, error: legalError } = await client
    .from("legal_document_versions")
    .select("id")
    .eq("document_key", "minimum_age_declaration")
    .eq("is_current", true)
    .lte("published_at", new Date().toISOString())
    .single<LegalDocumentRow>();

  if (legalError || !legalDocument) return false;

  const { data: acceptance, error: acceptanceError } = await client
    .from("legal_acceptances")
    .select("id")
    .eq("user_account_id", userAccountId)
    .eq("legal_document_version_id", legalDocument.id)
    .maybeSingle<LegalAcceptanceRow>();

  return !acceptanceError && Boolean(acceptance);
}

export async function canUseStoreAdministration(
  client: SupabaseClient,
  userAccountId: string,
) {
  const { data: account, error: accountError } = await client
    .from("user_accounts")
    .select("status")
    .eq("id", userAccountId)
    .maybeSingle<AccountRequirementRow>();

  if (accountError || account?.status !== "active") return false;

  return hasCurrentMinimumAgeAcceptance(client, userAccountId);
}
