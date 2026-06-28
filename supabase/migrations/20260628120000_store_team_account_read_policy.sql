create policy account_store_team_read on public.user_accounts for select
  to authenticated using (
    exists (
      select 1
      from public.store_memberships membership
      where membership.user_account_id = public.user_accounts.id
        and membership.deleted_at is null
        and public.is_store_wide_manager(membership.store_id)
    )
  );
