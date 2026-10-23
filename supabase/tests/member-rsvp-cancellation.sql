-- Synthetic fixtures only. All changes are rolled back and no emails are sent.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  applicant_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  applicant_email text := applicant_id::text || '@rsvp-cancel-test.invalid';
  result record;
  first_cancellation timestamptz;
begin
  if has_function_privilege('anon','public.cancel_member_rsvp(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.cancel_member_rsvp(uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.cancel_member_rsvp(uuid,text)','EXECUTE')
  then raise exception 'Cancellation permissions are incorrect'; end if;

  insert into auth.users(id,email,email_confirmed_at)
    values(owner_id,owner_id::text || '@rsvp-cancel-test.invalid',now());
  insert into public.applications(id,submission_hash,event_slug,full_name,email,affiliation,
    tshirt_size,dietary_restrictions,linkedin_url,stupidest_thing,coolest_build,
    attending,privacy_policy_version,admission_status)
  values(applicant_id,replace(applicant_id::text,'-','') || replace(applicant_id::text,'-',''),
    'ottawa-2026','Synthetic Cancellation Test',applicant_email,'test','M','none',
    'https://example.invalid','test','test',true,'test','accepted');
  insert into public.application_admissions(application_id,decision,notification_id,decided_by,
    email_status,email_payload,email_sent_at)
  values(applicant_id,'accepted',gen_random_uuid(),owner_id,'sent','{}',now());

  if exists(select 1 from public.cancel_member_rsvp(applicant_id,applicant_email))
  then raise exception 'Cancellation created a missing RSVP'; end if;
  perform * from public.save_member_rsvp(applicant_id,applicant_email,false,'train; staying with a friend');
  begin
    perform * from public.cancel_member_rsvp(applicant_id,'someone-else@example.invalid');
    raise exception 'Wrong email cancelled an RSVP';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.cancel_member_rsvp(other_id,applicant_email);
    raise exception 'Spoofed application ID cancelled an RSVP';
  exception when insufficient_privilege then null; end;

  select * into result from public.cancel_member_rsvp(applicant_id,applicant_email);
  if result.cancelled_at is null or result.travel_plan <> 'train; staying with a friend'
  then raise exception 'Cancellation did not retain the original RSVP'; end if;
  first_cancellation := result.cancelled_at;
  select * into result from public.cancel_member_rsvp(applicant_id,applicant_email);
  if result.cancelled_at <> first_cancellation then raise exception 'Repeated cancellation changed its timestamp'; end if;

  perform * from public.save_member_rsvp(applicant_id,applicant_email,true,null);
  if (select cancelled_at is not null from public.member_rsvps where application_id=applicant_id)
  then raise exception 'RSVP again before the deadline did not restore attendance'; end if;

  -- A closed RSVP window must block new attendance, but allow withdrawal.
  update public.application_admissions set email_sent_at=now()-interval '9 days' where application_id=applicant_id;
  select * into result from public.cancel_member_rsvp(applicant_id,applicant_email);
  if result.cancelled_at is null then raise exception 'Cancellation after the deadline failed'; end if;
  first_cancellation := result.cancelled_at;
  begin
    perform * from public.save_member_rsvp(applicant_id,applicant_email,true,null);
    raise exception 'Cancellation allowed RSVP again after the deadline';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'member_rsvp_closed' then raise; end if;
  end;
  if (select cancelled_at from public.member_rsvps where application_id=applicant_id) is distinct from first_cancellation
  then raise exception 'Expired save undid cancellation'; end if;
  if (select admission_status from public.applications where id=applicant_id) <> 'accepted'
  then raise exception 'Cancellation changed the admission decision'; end if;

  update public.applications set admission_status='rejected' where id=applicant_id;
  begin
    perform * from public.cancel_member_rsvp(applicant_id,applicant_email);
    raise exception 'Revoked member could change an RSVP';
  exception when insufficient_privilege then null; end;
  update public.applications set admission_status='accepted' where id=applicant_id;

  insert into public.applications(id,submission_hash,event_slug,full_name,email,affiliation,
    tshirt_size,dietary_restrictions,linkedin_url,stupidest_thing,coolest_build,
    attending,privacy_policy_version,admission_status,created_at)
  values(other_id,replace(other_id::text,'-','') || replace(other_id::text,'-',''),
    'ottawa-2026','Newer Synthetic Test',applicant_email,'test','M','none',
    'https://example.invalid','test','test',true,'test','accepted',now()+interval '1 second');
  begin
    perform * from public.cancel_member_rsvp(applicant_id,applicant_email);
    raise exception 'Superseded application could change an RSVP';
  exception when insufficient_privilege then null; end;
end;
$$;

rollback;
