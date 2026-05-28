begin;

update public.player_salary_references
   set reference_type = public.app_salary_reference_type(source_name, source_url, reference_type)
 where lower(coalesce(source_url, '')) like '%capology.com%';

update public.club_roster_players
   set salary_reference_type = public.app_salary_reference_type(
     coalesce(salary_source_name, source_name),
     coalesce(salary_source_url, source_url),
     salary_reference_type
   )
 where lower(coalesce(salary_source_url, source_url, '')) like '%capology.com%';

update public.transfers
   set salary_reference_type = public.app_salary_reference_type(
     salary_source_name,
     salary_source_url,
     salary_reference_type
   )
 where lower(coalesce(salary_source_url, '')) like '%capology.com%';

update public.internal_transfer_proposals
   set salary_reference_type = public.app_salary_reference_type(
     salary_source_name,
     salary_source_url,
     salary_reference_type
   )
 where lower(coalesce(salary_source_url, '')) like '%capology.com%';

commit;
