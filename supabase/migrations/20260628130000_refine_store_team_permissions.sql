create or replace function public.can_view_store_team(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_memberships m
    join public.stores s on s.id = m.store_id
    where m.user_account_id = auth.uid()
      and m.store_id = target_store_id
      and m.role in ('owner', 'admin')
      and m.status = 'active'
      and m.deleted_at is null
      and s.status in ('pending', 'active')
      and s.deleted_at is null
      and public.is_active_account(auth.uid())
  );
$$;

drop policy if exists memberships_store_manager_read on public.store_memberships;
create policy memberships_store_manager_read on public.store_memberships for select
  to authenticated using (
    user_account_id = auth.uid()
    or public.can_view_store_team(store_id)
  );

drop policy if exists assignments_membership_read on public.branch_membership_assignments;
create policy assignments_membership_read on public.branch_membership_assignments for select
  to authenticated using (
    exists (
      select 1
      from public.store_memberships m
      where m.id = store_membership_id
        and (m.user_account_id = auth.uid() or public.can_view_store_team(m.store_id))
    )
  );

drop policy if exists invitations_manager_read on public.store_membership_invitations;
create policy invitations_manager_read on public.store_membership_invitations for select
  to authenticated using (public.can_view_store_team(store_id));

drop policy if exists invitation_branches_manager_read on public.store_membership_invitation_branches;
create policy invitation_branches_manager_read on public.store_membership_invitation_branches for select
  to authenticated using (public.can_view_store_team(store_id));

drop policy if exists account_store_team_read on public.user_accounts;
create policy account_store_team_read on public.user_accounts for select
  to authenticated using (
    exists (
      select 1
      from public.store_memberships membership
      where membership.user_account_id = public.user_accounts.id
        and membership.deleted_at is null
        and public.can_view_store_team(membership.store_id)
    )
  );

create or replace function public.invite_store_member(store_id uuid, input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inviter public.store_memberships;
  invitation public.store_membership_invitations;
  token text := encode(extensions.gen_random_bytes(32), 'hex');
  branch_id_value uuid;
begin
  inviter := public.active_membership(store_id, null);
  if inviter.id is null or inviter.role = 'staff' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if inviter.role = 'admin' and inviter.scope <> 'store' then
    raise exception 'Store-wide admin required to invite team members' using errcode = '42501';
  end if;
  if inviter.role = 'admin' and input->>'role' = 'owner' then
    raise exception 'Admin cannot invite owners' using errcode = '42501';
  end if;

  insert into public.store_membership_invitations (
    store_id, email_normalized, role, scope, token_hash, invited_by_account_id, expires_at
  ) values (
    store_id, lower(trim(input->>'email'))::public.citext, input->>'role', input->>'scope',
    encode(extensions.digest(token, 'sha256'), 'hex'), auth.uid(), now() + interval '7 days'
  ) returning * into invitation;

  if invitation.scope = 'branches' then
    for branch_id_value in select jsonb_array_elements_text(input->'branchIds')::uuid loop
      if not exists (
        select 1
        from public.branches b
        where b.id = branch_id_value
          and b.store_id = invite_store_member.store_id
          and b.status = 'active'
          and b.deleted_at is null
      ) then
        raise exception 'Invalid invitation branch scope' using errcode = '42501';
      end if;
      insert into public.store_membership_invitation_branches (invitation_id, branch_id, store_id)
      values (invitation.id, branch_id_value, store_id);
    end loop;
    if not exists (select 1 from public.store_membership_invitation_branches where invitation_id = invitation.id) then
      raise exception 'Branch-scoped invitation requires branches' using errcode = '23514';
    end if;
  end if;

  perform public.audit('invitation.created', 'store_membership_invitation', invitation.id, store_id);
  return jsonb_build_object('invitationId', invitation.id, 'token', token, 'expiresAt', invitation.expires_at);
end;
$$;

create or replace function public.revoke_store_invitation(invitation_id uuid)
returns public.store_membership_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.store_memberships;
  result public.store_membership_invitations;
begin
  select * into result from public.store_membership_invitations where id = invitation_id for update;
  if result.id is null then
    raise exception 'Pending invitation not found' using errcode = 'P0002';
  end if;

  actor := public.active_membership(result.store_id, null);
  if actor.id is null or actor.role = 'staff' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if actor.role = 'admin' and result.role = 'owner' then
    raise exception 'Admin cannot revoke owner invitation' using errcode = '42501';
  end if;

  update public.store_membership_invitations set status = 'revoked', revoked_at = now()
    where id = invitation_id and status = 'pending' returning * into result;
  if result.id is null then raise exception 'Pending invitation not found' using errcode = 'P0002'; end if;
  perform public.audit('invitation.revoked', 'store_membership_invitation', result.id, result.store_id);
  return result;
end;
$$;

revoke all on function public.can_view_store_team(uuid) from public;
grant execute on function public.can_view_store_team(uuid) to authenticated;
