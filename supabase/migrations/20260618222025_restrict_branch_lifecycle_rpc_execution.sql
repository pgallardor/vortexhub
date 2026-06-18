revoke execute on function public.create_active_branch(uuid, jsonb) from public;
revoke execute on function public.create_active_branch(uuid, jsonb) from anon;
grant execute on function public.create_active_branch(uuid, jsonb) to authenticated;

revoke execute on function public.discard_draft_branch(uuid) from public;
revoke execute on function public.discard_draft_branch(uuid) from anon;
grant execute on function public.discard_draft_branch(uuid) to authenticated;
