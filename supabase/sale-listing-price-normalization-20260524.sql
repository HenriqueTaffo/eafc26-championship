-- Normalizacao de pedida na lista de venda - 24/05/2026.
-- Permite digitar "11" para representar 11 milhoes.

create or replace function public.app_upsert_transfer_sale_listing(
  p_manager_id text,
  p_access_code text,
  p_player text,
  p_asking_price numeric default 0,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
  v_owned record;
  v_default_asking numeric;
  v_asking_price numeric;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return jsonb_build_object('ok', false, 'message', 'Login do tecnico invalido.');
  end if;

  v_manager_name := v_session ->> 'managerName';

  with latest as (
    select
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      t.transfer_type,
      buyer.id as buyer_id,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
      and lower(t.player_name) = lower(trim(p_player))
  )
  select *
    into v_owned
  from latest
  where rn = 1
    and buyer_id = p_manager_id
    and transfer_type <> 'cpu_sale';

  if v_owned.player_name is null then
    return jsonb_build_object('ok', false, 'message', 'Esse jogador nao pertence ao elenco atual do tecnico.');
  end if;

  v_default_asking := round(greatest(coalesce(v_owned.base_value, 0), 1000000) * 1.12 / 100000) * 100000;
  v_asking_price := coalesce(p_asking_price, 0);

  if v_asking_price > 0 and v_asking_price < 1000 then
    v_asking_price := v_asking_price * 1000000;
  end if;

  insert into public.manager_transfer_listings (
    manager_id,
    manager_name,
    player_name,
    from_club,
    overall,
    base_value,
    asking_price,
    note,
    status,
    updated_at
  ) values (
    p_manager_id,
    v_manager_name,
    v_owned.player_name,
    coalesce(v_owned.from_club, ''),
    coalesce(v_owned.overall, 0),
    coalesce(v_owned.base_value, 0),
    greatest(v_asking_price, v_default_asking),
    coalesce(p_note, ''),
    'active',
    now()
  )
  on conflict (manager_id, lower(player_name)) where status = 'active'
  do update set
    manager_name = excluded.manager_name,
    from_club = excluded.from_club,
    overall = excluded.overall,
    base_value = excluded.base_value,
    asking_price = excluded.asking_price,
    note = excluded.note,
    updated_at = now();

  return public.app_get_my_transfer_sale_listings(p_manager_id, p_access_code);
end;
$$;

update public.manager_transfer_listings
   set status = 'active',
       asking_price = 11000000,
       updated_at = now(),
       resolved_at = null
 where lower(manager_name) = lower('Henrique')
   and lower(player_name) = lower('David de Gea')
   and status in ('active', 'removed');

grant execute on function public.app_upsert_transfer_sale_listing(text, text, text, numeric, text) to anon, authenticated;
