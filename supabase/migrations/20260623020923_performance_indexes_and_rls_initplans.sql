drop policy if exists own_account_read on public.user_accounts;
create policy own_account_read on public.user_accounts for select
  to authenticated using (id = (select auth.uid()));

drop policy if exists own_legal_acceptances_read on public.legal_acceptances;
create policy own_legal_acceptances_read on public.legal_acceptances for select
  to authenticated using (user_account_id = (select auth.uid()));

drop policy if exists memberships_store_manager_read on public.store_memberships;
create policy memberships_store_manager_read on public.store_memberships for select
  to authenticated using (
    user_account_id = (select auth.uid())
    or public.is_store_owner(store_id)
    or public.is_store_wide_manager(store_id)
  );

drop policy if exists assignments_membership_read on public.branch_membership_assignments;
create policy assignments_membership_read on public.branch_membership_assignments for select
  to authenticated using (
    exists (
      select 1 from public.store_memberships m
      where m.id = store_membership_id
        and (
          m.user_account_id = (select auth.uid())
          or public.is_store_owner(m.store_id)
          or public.is_store_wide_manager(m.store_id)
        )
    )
  );

create index if not exists events_event_series_store_fk_idx
  on public.events (event_series_id, store_id)
  where event_series_id is not null;

create index if not exists events_branch_store_fk_idx
  on public.events (branch_id, store_id)
  where branch_id is not null;

create index if not exists event_series_branch_store_fk_idx
  on public.event_series (branch_id, store_id)
  where branch_id is not null;

create index if not exists store_entitlements_active_expiry_idx
  on public.store_entitlements (ends_at)
  where status = 'active' and ends_at is not null;

create index if not exists store_media_assets_event_banner_status_idx
  on public.store_media_assets (status, store_id)
  where asset_type = 'event_banner' and deleted_at is null;

create index if not exists store_membership_invitations_terminal_cleanup_idx
  on public.store_membership_invitations ((coalesce(accepted_at, revoked_at, expires_at)))
  where status in ('accepted', 'revoked', 'expired');

create index if not exists branches_active_store_created_idx
  on public.branches (store_id, created_at, id)
  where status = 'active' and deleted_at is null;

create or replace function public.complete_due_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
  affected_step integer := 0;
begin
  update public.events
  set status = 'completed'
  where status = 'published'
    and deleted_at is null
    and ends_at <= now();
  get diagnostics affected_step = row_count;
  affected := affected + affected_step;

  update public.events
  set status = 'completed'
  where status = 'published'
    and deleted_at is null
    and ends_at is null
    and starts_at <= now() - interval '6 hours';
  get diagnostics affected_step = row_count;
  affected := affected + affected_step;

  return affected;
end;
$$;

create or replace function public.archive_due_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
  affected_step integer := 0;
begin
  update public.events
  set archived_at = now()
  where status in ('completed', 'cancelled')
    and archived_at is null
    and ends_at <= now() - interval '12 months';
  get diagnostics affected_step = row_count;
  affected := affected + affected_step;

  update public.events
  set archived_at = now()
  where status in ('completed', 'cancelled')
    and archived_at is null
    and ends_at is null
    and starts_at <= now() - interval '12 months';
  get diagnostics affected_step = row_count;
  affected := affected + affected_step;

  return affected;
end;
$$;

create or replace function public.maintain_premium_assets()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
  pending_count integer;
  restored_count integer;
  removed_count integer;
begin
  update public.store_entitlements
  set status = 'expired'
  where status = 'active'
    and ends_at is not null
    and ends_at <= now();
  get diagnostics expired_count = row_count;

  update public.store_media_assets a
  set status = 'pending_removal',
      remove_after = now() + interval '30 days'
  where a.asset_type = 'event_banner'
    and a.status = 'active'
    and a.deleted_at is null
    and not exists (
      select 1
      from public.store_entitlements e
      where e.store_id = a.store_id
        and e.feature = 'custom_event_banners'
        and e.status = 'active'
        and e.starts_at <= now()
        and (e.ends_at is null or e.ends_at > now())
    );
  get diagnostics pending_count = row_count;

  update public.store_media_assets a
  set status = 'active',
      remove_after = null
  where a.asset_type = 'event_banner'
    and a.status = 'pending_removal'
    and a.deleted_at is null
    and exists (
      select 1
      from public.store_entitlements e
      where e.store_id = a.store_id
        and e.feature = 'custom_event_banners'
        and e.status = 'active'
        and e.starts_at <= now()
        and (e.ends_at is null or e.ends_at > now())
    );
  get diagnostics restored_count = row_count;

  update public.store_media_assets
  set status = 'removed',
      remove_after = null,
      deleted_at = now()
  where asset_type = 'event_banner'
    and status = 'pending_removal'
    and deleted_at is null
    and remove_after <= now();
  get diagnostics removed_count = row_count;

  return jsonb_build_object(
    'expiredEntitlements', expired_count,
    'pendingAssets', pending_count,
    'restoredAssets', restored_count,
    'removedAssets', removed_count
  );
end;
$$;
