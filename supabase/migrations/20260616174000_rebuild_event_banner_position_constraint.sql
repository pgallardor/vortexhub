do $$
declare
  constraint_record record;
begin
  alter table public.events
    add column if not exists banner_position varchar(30) not null default 'center';

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%banner_position%'
  loop
    execute format('alter table public.events drop constraint %I', constraint_record.conname);
  end loop;

  update public.events
  set banner_position = case banner_position
    when 'top' then 'center 20%'
    when 'bottom' then 'center 80%'
    when 'left' then 'left center'
    when 'right' then 'right center'
    when 'center top' then 'center 20%'
    when 'center bottom' then 'center 80%'
    else coalesce(nullif(banner_position, ''), 'center')
  end;

  execute $sql$
    alter table public.events
    add constraint events_banner_position_check
    check (banner_position in (
      'center 20%', 'center 32%', 'center 42%', 'center',
      'center 58%', 'center 68%', 'center 80%',
      'left center', 'right center'
    ))
  $sql$;
end $$;
