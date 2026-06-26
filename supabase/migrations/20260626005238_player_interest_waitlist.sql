create table public.player_launch_interests (
  id uuid primary key default gen_random_uuid(),
  email_normalized citext not null,
  source varchar(40) not null default 'player_tab',
  consent_version varchar(40) not null default 'player_launch_v1',
  consent_launch_email boolean not null default true,
  status varchar(30) not null default 'active',
  launch_reminder_sent_at timestamptz null,
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_launch_interests_email_length_check
    check (length(email_normalized::text) between 3 and 320),
  constraint player_launch_interests_source_check
    check (source in ('player_tab')),
  constraint player_launch_interests_consent_check
    check (consent_launch_email),
  constraint player_launch_interests_status_check
    check (status in ('active', 'archived'))
);

create unique index player_launch_interests_active_email_uq
on public.player_launch_interests (email_normalized)
where status = 'active';

create trigger set_player_launch_interests_updated_at
before update on public.player_launch_interests
for each row execute function public.set_updated_at();

alter table public.player_launch_interests enable row level security;

create or replace function public.register_player_launch_interest(input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_value text := lower(trim(input ->> 'email'));
  source_value text := coalesce(nullif(trim(input ->> 'source'), ''), 'player_tab');
begin
  if email_value is null
    or length(email_value) < 3
    or length(email_value) > 320
    or email_value !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  then
    raise exception 'Invalid launch interest email' using errcode = '22023';
  end if;

  if source_value <> 'player_tab' then
    raise exception 'Unsupported launch interest source' using errcode = '22023';
  end if;

  insert into public.player_launch_interests (
    email_normalized,
    source,
    consent_version,
    consent_launch_email,
    status,
    last_submitted_at
  ) values (
    email_value,
    source_value,
    'player_launch_v1',
    true,
    'active',
    now()
  )
  on conflict (email_normalized) where status = 'active'
  do update set
    source = excluded.source,
    consent_version = excluded.consent_version,
    consent_launch_email = excluded.consent_launch_email,
    last_submitted_at = now(),
    updated_at = now();

  return jsonb_build_object('status', 'registered');
end;
$$;

revoke all on function public.register_player_launch_interest(jsonb) from public;
grant execute on function public.register_player_launch_interest(jsonb) to anon, authenticated;
