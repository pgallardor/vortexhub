grant usage on schema public to anon, authenticated;

grant select on public.games, public.platform_event_banners to anon, authenticated;
grant select on public.stores, public.branches, public.event_series, public.events to authenticated;
grant select on public.legal_document_versions, public.user_accounts, public.legal_acceptances to authenticated;
grant select on public.store_memberships, public.branch_membership_assignments to authenticated;
grant select on public.store_membership_invitations, public.store_membership_invitation_branches to authenticated;
grant select on public.store_entitlements, public.store_media_assets to authenticated;

create policy games_public_read on public.games for select
  to anon, authenticated using (is_active);

create policy platform_banners_public_read on public.platform_event_banners for select
  to anon, authenticated using (status = 'active');

create policy stores_operator_read on public.stores for select
  to authenticated using (public.can_read_store(id, null));

create policy branches_operator_read on public.branches for select
  to authenticated using (public.can_read_store(store_id, id));

create policy series_operator_read on public.event_series for select
  to authenticated using (public.can_read_store(store_id, branch_id));

create policy events_operator_read on public.events for select
  to authenticated using (public.can_read_store(store_id, branch_id));

create policy own_account_read on public.user_accounts for select
  to authenticated using (id = auth.uid());

create policy current_legal_documents_read on public.legal_document_versions for select
  to authenticated using (published_at <= now());

create policy own_legal_acceptances_read on public.legal_acceptances for select
  to authenticated using (user_account_id = auth.uid());

create policy memberships_store_manager_read on public.store_memberships for select
  to authenticated using (
    user_account_id = auth.uid()
    or public.is_store_owner(store_id)
    or public.is_store_wide_manager(store_id)
  );

create policy assignments_membership_read on public.branch_membership_assignments for select
  to authenticated using (
    exists (
      select 1 from public.store_memberships m
      where m.id = store_membership_id
        and (m.user_account_id = auth.uid() or public.is_store_owner(m.store_id) or public.is_store_wide_manager(m.store_id))
    )
  );

create policy invitations_manager_read on public.store_membership_invitations for select
  to authenticated using (public.is_store_owner(store_id) or public.is_store_wide_manager(store_id));

create policy invitation_branches_manager_read on public.store_membership_invitation_branches for select
  to authenticated using (public.is_store_owner(store_id) or public.is_store_wide_manager(store_id));

create policy entitlements_manager_read on public.store_entitlements for select
  to authenticated using (public.is_store_owner(store_id) or public.is_store_wide_manager(store_id));

create policy media_manager_read on public.store_media_assets for select
  to authenticated using (public.is_store_owner(store_id) or public.is_store_wide_manager(store_id));
