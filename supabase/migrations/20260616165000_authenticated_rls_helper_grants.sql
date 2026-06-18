grant execute on function public.is_active_account(uuid) to authenticated;
grant execute on function public.active_membership(uuid, uuid) to authenticated;
grant execute on function public.can_read_store(uuid, uuid) to authenticated;
grant execute on function public.can_manage_store(uuid, uuid) to authenticated;
grant execute on function public.is_store_owner(uuid) to authenticated;
grant execute on function public.is_store_wide_manager(uuid) to authenticated;
