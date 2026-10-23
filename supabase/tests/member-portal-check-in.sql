begin;
do $$
declare
  organizer_id uuid := gen_random_uuid();
  disabled_id uuid := gen_random_uuid();
  applicant_id uuid := gen_random_uuid();
  newer_id uuid := gen_random_uuid();
  token uuid;
  result jsonb;
  first_check_in timestamptz;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (organizer_id,organizer_id::text||'@check-in.invalid',now()),
    (disabled_id,disabled_id::text||'@check-in.invalid',now());
  insert into private.organizer_reviewers(user_id,email,enabled,can_view_all_reviews) values
    (organizer_id,organizer_id::text||'@check-in.invalid',true,false),
    (disabled_id,disabled_id::text||'@check-in.invalid',false,false);
  insert into public.applications(id,submission_hash,event_slug,full_name,email,affiliation,tshirt_size,dietary_restrictions,linkedin_url,stupidest_thing,coolest_build,attending,privacy_policy_version,intake_status,admission_status)
    values(applicant_id,replace(applicant_id::text,'-','')||replace(applicant_id::text,'-',''),'ottawa-2026','Synthetic Check-in',applicant_id::text||'@check-in.invalid','Synthetic School','M','none','https://example.invalid','Fixture','Fixture',true,'test','complete','accepted');
  insert into public.member_rsvps(application_id,is_local) values(applicant_id,true) returning qr_token into token;
  if token is null then raise exception 'No persistent QR token'; end if;
  result := public.organizer_lookup_rsvp(organizer_id,token);
  if result->>'status'<>'ready' or result->>'full_name'<>'Synthetic Check-in'
    or exists(select 1 from public.member_rsvps where application_id=applicant_id and checked_in_at is not null)
    then raise exception 'Lookup changed attendance or returned the wrong person'; end if;
  begin
    perform public.organizer_check_in_rsvp(organizer_id,token,false);
    raise exception 'Check-in did not require explicit confirmation';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.organizer_lookup_rsvp(disabled_id,token);
    raise exception 'Disabled organizer read a ticket';
  exception when insufficient_privilege then null; end;
  begin
    perform public.organizer_check_in_rsvp(disabled_id,token,true);
    raise exception 'Disabled organizer checked someone in';
  exception when insufficient_privilege then null; end;
  begin
    perform public.organizer_lookup_rsvp(organizer_id,gen_random_uuid());
    raise exception 'Unknown code was accepted';
  exception when no_data_found then null; end;
  update public.member_rsvps set cancelled_at=now() where application_id=applicant_id;
  if public.organizer_lookup_rsvp(organizer_id,token)->>'status'<>'cancelled' then raise exception 'Cancelled RSVP not shown'; end if;
  begin
    perform public.organizer_check_in_rsvp(organizer_id,token,true);
    raise exception 'Cancelled RSVP was checked in';
  exception when raise_exception then if sqlerrm<>'check_in_cancelled' then raise; end if; end;
  update public.member_rsvps set cancelled_at=null where application_id=applicant_id;
  update public.applications set admission_status='rejected' where id=applicant_id;
  if public.organizer_lookup_rsvp(organizer_id,token)->>'status'<>'not_eligible' then raise exception 'Rejected admission was eligible'; end if;
  begin
    perform public.organizer_check_in_rsvp(organizer_id,token,true);
    raise exception 'Rejected admission was checked in';
  exception when raise_exception then if sqlerrm<>'check_in_not_eligible' then raise; end if; end;
  update public.applications set admission_status='accepted' where id=applicant_id;
  insert into public.applications(id,submission_hash,event_slug,full_name,email,affiliation,tshirt_size,dietary_restrictions,linkedin_url,stupidest_thing,coolest_build,attending,privacy_policy_version,intake_status,admission_status,created_at)
    values(newer_id,replace(newer_id::text,'-','')||replace(newer_id::text,'-',''),'ottawa-2026','Synthetic Newer',applicant_id::text||'@check-in.invalid','Synthetic School','M','none','https://example.invalid','Fixture','Fixture',true,'test','complete','pending',now()+interval '1 second');
  if public.organizer_lookup_rsvp(organizer_id,token)->>'status'<>'not_eligible' then raise exception 'Superseded application was eligible'; end if;
  delete from public.applications where id=newer_id;
  result := public.organizer_check_in_rsvp(organizer_id,token,true);
  if result->>'status'<>'checked_in' then raise exception 'Explicit check-in failed'; end if;
  select checked_in_at into first_check_in from public.member_rsvps where application_id=applicant_id;
  result := public.organizer_check_in_rsvp(organizer_id,token,true);
  if result->>'status'<>'already_checked_in'
    or (select checked_in_at from public.member_rsvps where application_id=applicant_id) is distinct from first_check_in
    or (select count(*) from public.organizer_audit where application_id=applicant_id and action='rsvp_checked_in')<>1
    then raise exception 'Repeat scan changed the original check-in or audit'; end if;
  if has_table_privilege('anon','public.member_rsvps','select')
    or has_table_privilege('authenticated','public.member_rsvps','select')
    or has_function_privilege('anon','public.organizer_lookup_rsvp(uuid,uuid)','execute')
    or has_function_privilege('authenticated','public.organizer_check_in_rsvp(uuid,uuid,boolean)','execute')
    then raise exception 'Ticket access was exposed to browser roles'; end if;
end $$;
rollback;
select true as qr_lookup_and_explicit_check_in_verified;
