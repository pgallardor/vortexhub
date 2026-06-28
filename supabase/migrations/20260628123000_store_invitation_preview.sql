create or replace function public.get_store_invitation_preview(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation record;
  branch_names text[];
begin
  if token is null or length(trim(token)) < 32 then
    return null;
  end if;

  select
    i.id,
    i.email_normalized,
    i.role,
    i.scope,
    i.expires_at,
    s.name as store_name
  into invitation
  from public.store_membership_invitations i
  join public.stores s on s.id = i.store_id
  where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
    and i.status = 'pending'
    and i.expires_at > now()
    and s.status in ('pending', 'active')
    and s.deleted_at is null;

  if invitation.id is null then
    return null;
  end if;

  select coalesce(array_agg(b.name order by b.name), '{}'::text[])
  into branch_names
  from public.store_membership_invitation_branches ib
  join public.branches b on b.id = ib.branch_id
  where ib.invitation_id = invitation.id;

  return jsonb_build_object(
    'email', invitation.email_normalized::text,
    'role', invitation.role,
    'scope', invitation.scope,
    'storeName', invitation.store_name,
    'expiresAt', invitation.expires_at,
    'branchNames', coalesce(branch_names, '{}'::text[])
  );
end;
$$;

revoke all on function public.get_store_invitation_preview(text) from public;
grant execute on function public.get_store_invitation_preview(text) to anon, authenticated;
