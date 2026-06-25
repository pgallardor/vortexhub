create or replace function public.active_membership(target_store_id uuid, target_branch_id uuid default null)
returns public.store_memberships
language sql
stable
security definer
set search_path = ''
as $$
  select m
  from public.store_memberships m
  join public.stores s on s.id = m.store_id
  where m.user_account_id = auth.uid()
    and m.store_id = target_store_id
    and m.status = 'active'
    and m.deleted_at is null
    and s.status in ('pending', 'active')
    and s.deleted_at is null
    and public.is_active_account(auth.uid())
    and (
      m.scope = 'store'
      or (
        target_branch_id is not null
        and exists (
          select 1 from public.branch_membership_assignments a
          join public.branches b on b.id = a.branch_id
          where a.store_membership_id = m.id
            and a.branch_id = target_branch_id
            and b.status = 'active'
            and b.deleted_at is null
        )
      )
    )
  order by case m.role when 'owner' then 1 when 'admin' then 2 else 3 end
  limit 1;
$$;

revoke all on function public.active_membership(uuid, uuid) from public;
grant execute on function public.active_membership(uuid, uuid) to authenticated;
