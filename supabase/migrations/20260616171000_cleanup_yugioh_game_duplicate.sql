do $$
declare
  canonical_game_id uuid;
  duplicate_game_id uuid;
begin
  select id
  into canonical_game_id
  from public.games
  where slug = 'yugioh';

  if canonical_game_id is null then
    select id
    into canonical_game_id
    from public.games
    where slug in ('yu-gi-oh', 'yu-gi-oh-tcg')
    order by created_at
    limit 1;

    if canonical_game_id is not null then
      update public.games
      set slug = 'yugioh',
          name = 'Yu-Gi-Oh!',
          publisher = null,
          is_active = true,
          updated_at = now()
      where id = canonical_game_id;
    end if;
  else
    update public.games
    set name = 'Yu-Gi-Oh!',
        publisher = null,
        is_active = true,
        updated_at = now()
    where id = canonical_game_id;
  end if;

  for duplicate_game_id in
    select id
    from public.games
    where slug in ('yu-gi-oh', 'yu-gi-oh-tcg')
      and id <> canonical_game_id
  loop
    update public.events
    set game_id = canonical_game_id,
        updated_at = now()
    where game_id = duplicate_game_id;

    update public.event_series
    set game_id = canonical_game_id,
        updated_at = now()
    where game_id = duplicate_game_id;

    update public.platform_event_banners
    set status = 'inactive',
        is_default = false,
        updated_at = now()
    where game_id = duplicate_game_id;

    delete from public.games
    where id = duplicate_game_id;
  end loop;
end $$;
