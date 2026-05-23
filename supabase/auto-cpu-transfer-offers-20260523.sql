-- Automatic CPU transfer offers - 23/05/2026.
--
-- The app calls app_generate_due_cpu_transfer_proposals on load/login. The
-- database keeps the daily throttle, so multiple users opening the app cannot
-- flood technicians with offers.

begin;

create table if not exists public.cpu_transfer_offer_runs (
  id bigserial primary key,
  run_date date not null,
  run_kind text not null default 'daily',
  created_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_date, run_kind)
);

create or replace function public.app_generate_due_cpu_transfer_proposals(
  p_count integer default 4
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id bigint;
  v_run_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_count integer := least(8, greatest(1, coalesce(p_count, 4)));
  v_created integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  insert into public.cpu_transfer_offer_runs (run_date, run_kind)
  values (v_run_date, 'daily')
  on conflict (run_date, run_kind) do nothing
  returning id into v_run_id;

  if v_run_id is null then
    return jsonb_build_object(
      'ok', true,
      'created', 0,
      'skipped', true,
      'message', 'Propostas automáticas da CPU já foram avaliadas hoje.'
    );
  end if;

  with latest as (
    select
      t.id,
      t.player_name,
      t.from_club,
      t.overall,
      greatest(coalesce(t.negotiated_value, 0), coalesce(t.final_value, 0), coalesce(t.market_value, 0)) as base_value,
      case when t.transfer_type = 'cpu_sale' then 'CPU' else buyer.display_name end as seller,
      t.transfer_type,
      row_number() over (
        partition by lower(t.player_name)
        order by t.created_at desc nulls last, t.id desc
      ) as rn
    from public.transfers t
    join public.managers buyer on buyer.id = t.buyer_id
    where t.status = 'approved'
  ),
  eligible as (
    select *
    from latest l
    where l.rn = 1
      and l.transfer_type <> 'cpu_sale'
      and lower(l.seller) <> 'cpu'
      and coalesce(l.base_value, 0) >= 1000000
      and not exists (
        select 1
        from public.internal_transfer_proposals p
        where p.status = 'pending'
          and lower(p.seller) = lower(l.seller)
          and lower(p.player) = lower(l.player_name)
          and (
            coalesce(p.is_cpu_offer, false)
            or lower(coalesce(p.offer_source, '')) = 'cpu'
            or lower(coalesce(p.buyer, '')) = 'cpu'
          )
      )
    order by random()
    limit v_count
  ),
  prepared as (
    select
      'CPU'::text as buyer,
      seller,
      player_name as player,
      coalesce(nullif(from_club, ''), 'Elenco de ' || seller) as from_club,
      overall,
      greatest(
        1000000,
        round((
          base_value *
          case
            when coalesce(overall, 0) >= 84 then 1.18 + (random() * 0.22)
            when coalesce(overall, 0) >= 80 then 1.12 + (random() * 0.18)
            else 1.08 + (random() * 0.14)
          end
        ) / 100000) * 100000
      )::numeric as proposed_value
    from eligible
  ),
  inserted as (
    insert into public.internal_transfer_proposals (
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      is_cpu_offer,
      offer_source
    )
    select
      buyer,
      seller,
      player,
      from_club,
      overall,
      proposed_value,
      true,
      'cpu'
    from prepared
    returning *
  )
  select count(*)::integer, coalesce(jsonb_agg(to_jsonb(inserted) order by created_at desc), '[]'::jsonb)
    into v_created, v_rows
  from inserted;

  update public.cpu_transfer_offer_runs
     set created_count = v_created,
         updated_at = now()
   where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'skipped', false,
    'runDate', v_run_date,
    'offers', v_rows,
    'message', case
      when v_created = 0 then 'Nenhum jogador elegível para proposta automática da CPU hoje.'
      when v_created = 1 then '1 proposta automática da CPU gerada.'
      else v_created::text || ' propostas automáticas da CPU geradas.'
    end
  );
end;
$$;

grant execute on function public.app_generate_due_cpu_transfer_proposals(integer) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
