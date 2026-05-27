-- v106 - Transfer negotiation timeline from backend audit logs.
-- Builds a per-proposal timeline from backend_operation_audits for the logged
-- manager so UI can render real negotiation stages and avoid synthetic-only UX.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto;

create index if not exists ix_backend_operation_audits_actor_created
  on public.backend_operation_audits (actor_manager_id, created_at desc);

create or replace function public.app_get_transfer_negotiation_audit_timeline(
  p_manager_id text,
  p_access_code text,
  p_proposal_ids bigint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session jsonb;
  v_manager_name text;
  v_targets bigint[];
  v_results jsonb := '[]'::jsonb;
  v_timeline jsonb;
  v_proposal record;
  v_audit record;
  v_audit_proposal_id bigint;
  v_event_when timestamptz;
  v_status text;
  v_decision text;
  v_title text;
  v_detail text;
  v_tone text;
  v_answer_seen boolean;
  v_is_external boolean;
begin
  v_session := public.app_security_login(p_manager_id, p_access_code)::jsonb;
  if coalesce((v_session ->> 'ok')::boolean, false) is false
    or coalesce((v_session ->> 'isCommissioner')::boolean, false) is true then
    return '[]'::jsonb;
  end if;

  v_manager_name := coalesce(v_session ->> 'managerName', '');
  v_targets := coalesce(p_proposal_ids, '{}'::bigint[]);

  for v_proposal in
    select
      p.id,
      p.created_at,
      p.answered_at,
      p.buyer,
      p.seller,
      p.player,
      p.from_club,
      p.status,
      p.response_message,
      p.answered_by,
      p.proposal_type
    from public.internal_transfer_proposals p
    where (
      lower(trim(coalesce(p.buyer, ''))) = lower(trim(coalesce(v_manager_name, '')))
      or lower(trim(coalesce(p.seller, ''))) = lower(trim(coalesce(v_manager_name, '')))
    )
      and (
        cardinality(v_targets) = 0
        or p.id = any(v_targets)
      )
    order by p.created_at desc
  loop
    v_timeline := '[]'::jsonb;
    v_answer_seen := false;

    for v_audit in
      select
        ba.id,
        ba.operation_name,
        ba.actor_manager_name,
        ba.request_payload,
        ba.response_payload,
        ba.created_at as created_at,
        ba.finished_at as finished_at
      from public.backend_operation_audits ba
      where ba.actor_manager_id = p_manager_id
        and ba.operation_name in (
          'app_create_internal_transfer_proposal',
          'app_create_external_transfer_proposal',
          'app_answer_internal_transfer_proposal',
          'app_answer_external_transfer_proposal'
        )
      order by ba.created_at asc, ba.id asc
    loop
      v_audit_proposal_id := null;

      if (v_audit.response_payload ? 'proposalId')
         and (v_audit.response_payload ->> 'proposalId') ~ '^[0-9]+$' then
        v_audit_proposal_id := (v_audit.response_payload ->> 'proposalId')::bigint;
      elsif (v_audit.response_payload ? 'proposal_id')
         and (v_audit.response_payload ->> 'proposal_id') ~ '^[0-9]+$' then
        v_audit_proposal_id := (v_audit.response_payload ->> 'proposal_id')::bigint;
      elsif (v_audit.request_payload ? 'proposalId')
         and (v_audit.request_payload ->> 'proposalId') ~ '^[0-9]+$' then
        v_audit_proposal_id := (v_audit.request_payload ->> 'proposalId')::bigint;
      elsif (v_audit.request_payload ? 'proposal_id')
         and (v_audit.request_payload ->> 'proposal_id') ~ '^[0-9]+$' then
        v_audit_proposal_id := (v_audit.request_payload ->> 'proposal_id')::bigint;
      end if;

      if v_audit_proposal_id is null or v_audit_proposal_id <> v_proposal.id then
        continue;
      end if;

      v_status := lower(coalesce(v_audit.response_payload ->> 'status', ''));
      v_decision := lower(coalesce(v_audit.request_payload ->> 'decision', ''));
      v_event_when := coalesce(v_audit.finished_at, v_audit.created_at);
      v_is_external := v_audit.operation_name in ('app_create_external_transfer_proposal', 'app_answer_external_transfer_proposal');

      if v_audit.operation_name like 'app_create_%' then
        if v_is_external then
          v_title := 'Proposta enviada para mercado';
          v_detail := coalesce(
            v_audit.response_payload ->> 'message',
            'Proposta enviada ao clube vendedor para analise comercial.'
          );
        else
          v_title := 'Proposta enviada ao técnico vendedor';
          v_detail := coalesce(
            v_audit.response_payload ->> 'message',
            'Proposta enviada ao técnico vendedor.'
          );
        end if;
        v_tone := 'live';
      else
        v_answer_seen := true;
        if v_decision ~ 'aceit|accepted|aprov' then
          v_title := 'Oferta aceita';
          v_tone := 'success';
        elsif v_decision ~ 'counter|contra' then
          v_title := 'Contraoferta enviada';
          v_tone := 'watch';
        elsif v_decision ~ 'reject|rejeit|recus|desist' then
          v_title := 'Negociação encerrada';
          v_tone := 'hot';
        elsif v_status in ('buyer_review', 'signature_pending') then
          v_title := 'Resposta em análise';
          v_tone := 'watch';
        elsif v_status = 'rejected' then
          v_title := 'Proposta recusada';
          v_tone := 'hot';
        elsif v_status = 'accepted' then
          v_title := 'Oferta aceita';
          v_tone := 'success';
        else
          v_title := 'Resposta do clube';
          v_tone := 'watch';
        end if;

        v_detail := coalesce(
          nullif(v_audit.response_payload ->> 'message', ''),
          nullif(v_audit.request_payload ->> 'decision', ''),
          case
            when v_is_external and v_status = 'signature_pending'
              then 'A assinatura pendente precisará de conclusao no escritorio.'
            else 'Resposta registrada para esta negociação.'
          end
        );
      end if;

      if v_detail is null then
        v_detail := 'Sem descricao detalhada do evento.';
      end if;

      v_timeline := v_timeline || jsonb_build_array(
        jsonb_build_object(
          'operation',
          v_audit.operation_name,
          'when',
          v_event_when,
          'title',
          v_title,
          'detail',
          v_detail,
          'tone',
          v_tone,
          'status',
          v_status,
          'decision',
          nullif(v_decision, ''),
          'raw',
          jsonb_build_object(
            'actor',
            coalesce(v_audit.actor_manager_name, ''),
            'requestPayload',
            v_audit.request_payload,
            'responsePayload',
            v_audit.response_payload
          )
        )
      );
    end loop;

    if coalesce(jsonb_array_length(v_timeline), 0) = 0 then
      v_timeline := v_timeline || jsonb_build_array(
        jsonb_build_object(
          'operation',
          'fallback_created',
          'when',
          v_proposal.created_at,
          'title',
          'Proposta registrada',
          'detail',
          format(
            '%s iniciou negociacao com %s.',
            coalesce(v_proposal.buyer, 'Tecnico'),
            coalesce(v_proposal.player, 'Jogador')
          ),
          'tone',
          'live',
          'status',
          'pending'
        )
      );
    end if;

    if not v_answer_seen
       and v_proposal.answered_at is not null
       and lower(coalesce(v_proposal.status, '')) not in ('pending', 'buyer_review') then
      v_timeline := v_timeline || jsonb_build_array(
        jsonb_build_object(
          'operation',
          'fallback_status',
          'when',
          v_proposal.answered_at,
          'title',
          case
            when lower(v_proposal.status) = 'signature_pending'
              then 'Aguardando assinatura'
            when lower(v_proposal.status) = 'accepted'
              then 'Contrato aceito'
            when lower(v_proposal.status) = 'rejected'
              then 'Negociacao recusada'
            else 'Status atualizado'
          end,
          'detail',
          coalesce(v_proposal.response_message, 'status atualizado'),
          'tone',
          case
            when lower(v_proposal.status) = 'accepted'
              then 'success'
            when lower(v_proposal.status) = 'rejected'
              then 'hot'
            when lower(v_proposal.status) = 'signature_pending'
              then 'watch'
            else 'watch'
          end,
          'status',
          lower(coalesce(v_proposal.status, ''))
        )
      );
    elsif lower(v_proposal.status) = 'signature_pending'
      and coalesce(jsonb_array_length(v_timeline), 0) > 0 then
      v_timeline := v_timeline || jsonb_build_array(
        jsonb_build_object(
          'operation',
          'fallback_signature_pending',
          'when',
          v_proposal.answered_at,
          'title',
          'Aguardando assinatura',
          'detail',
          coalesce(v_proposal.response_message, 'A negociacao esta em etapa de assinatura no escritorio.'),
          'tone',
          'watch',
          'status',
          'signature_pending'
        )
      );
    end if;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'proposalId',
        v_proposal.id,
        'timeline',
        v_timeline
      )
    );
  end loop;

  return coalesce(v_results, '[]'::jsonb);
end;
$$;

grant execute on function public.app_get_transfer_negotiation_audit_timeline(text, text, bigint[]) to anon, authenticated;

commit;
