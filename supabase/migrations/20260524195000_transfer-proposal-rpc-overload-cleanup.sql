-- v82 - Remove ambiguous transfer proposal RPC overload - 24/05/2026
-- The 5-argument function has p_counter_value. Keeping the legacy 4-argument
-- wrapper makes PostgREST unable to choose a function when a reject/accept
-- request is sent without a counter value.

drop function if exists public.app_answer_internal_transfer_proposal(text, text, bigint, text);

grant execute on function public.app_answer_internal_transfer_proposal(text, text, bigint, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
