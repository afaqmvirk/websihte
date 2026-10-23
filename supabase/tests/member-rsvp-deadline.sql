-- Synthetic fixtures and state changes are rolled back; no emails are sent.
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  applicant_id uuid := gen_random_uuid();
  applicant_email text := applicant_id::text || '@rsvp-deadline-test.invalid';
  fixture record;
  saved record;
begin
  if has_function_privilege('anon', 'public.member_rsvp_deadline(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.member_rsvp_deadline(uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.member_rsvp_deadline(uuid)', 'EXECUTE')
  then raise exception 'Deadline function privileges are incorrect'; end if;

  insert into auth.users(id,email,email_confirmed_at)
    values (owner_id, owner_id::text || '@rsvp-deadline-test.invalid', now());
  insert into public.applications(id,submission_hash,event_slug,full_name,email,affiliation,
    tshirt_size,dietary_restrictions,linkedin_url,stupidest_thing,coolest_build,
    attending,privacy_policy_version,admission_status)
  values (applicant_id, replace(applicant_id::text,'-','') || replace(applicant_id::text,'-',''),
    'ottawa-2026','Synthetic RSVP Deadline Test',applicant_email,'test','M','none',
    'https://example.invalid','test','test',true,'test','accepted');

  -- A manual acceptance cannot silently create an arbitrary deadline.
  if public.member_rsvp_deadline(applicant_id) is not null then raise exception 'Missing acceptance has a deadline'; end if;
  begin
    perform * from public.save_member_rsvp(applicant_id,applicant_email,true,null);
    raise exception 'RSVP allowed before acceptance email';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'member_rsvp_not_open' then raise; end if;
  end;

  insert into public.application_admissions(application_id,decision,notification_id,decided_by,
    email_status,email_payload,email_sent_at)
  values (applicant_id,'accepted',gen_random_uuid(),owner_id,'sent','{}',now());

  -- Calendar-day deadlines, local date boundaries, and both DST transitions.
  -- Deliberately change the database session timezone to catch accidental use.
  perform set_config('TimeZone','Asia/Tokyo',true);
  for fixture in select * from (values
    ('2026-10-22T12:00:00Z'::timestamptz, '2026-10-30T04:00:00Z'::timestamptz),
    ('2026-10-23T02:00:00Z'::timestamptz, '2026-10-30T04:00:00Z'::timestamptz),
    ('2026-10-26T12:00:00Z'::timestamptz, '2026-11-03T05:00:00Z'::timestamptz),
    ('2026-03-02T12:00:00Z'::timestamptz, '2026-03-10T04:00:00Z'::timestamptz)
  ) as dates(sent_at,deadline) loop
    update public.application_admissions set email_sent_at=fixture.sent_at where application_id=applicant_id;
    if public.member_rsvp_deadline(applicant_id) is distinct from fixture.deadline
    then raise exception 'Wrong Ottawa deadline for %', fixture.sent_at; end if;
  end loop;

  update public.application_admissions set email_sent_at=now() where application_id=applicant_id;
  select * into saved from public.save_member_rsvp(applicant_id,applicant_email,false,'train; staying with a friend');
  if saved.travel_plan <> 'train; staying with a friend' then raise exception 'Open RSVP failed'; end if;
  perform * from public.save_member_rsvp(applicant_id,applicant_email,true,null);

  -- Expiry rejects both first submissions and edits without altering saved data.
  update public.application_admissions set email_sent_at=now()-interval '9 days' where application_id=applicant_id;
  begin
    perform * from public.save_member_rsvp(applicant_id,applicant_email,false,'late edit');
    raise exception 'Expired RSVP edit allowed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'member_rsvp_closed' then raise; end if;
  end;
  if not (select is_local from public.member_rsvps where application_id=applicant_id)
  then raise exception 'Late edit changed saved RSVP'; end if;
  delete from public.member_rsvps where application_id=applicant_id;
  begin
    perform * from public.save_member_rsvp(applicant_id,applicant_email,true,null);
    raise exception 'Expired first RSVP allowed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'member_rsvp_closed' then raise; end if;
  end;
  if exists(select 1 from public.member_rsvps where application_id=applicant_id)
  then raise exception 'Late RSVP was stored'; end if;

  update public.application_admissions set email_status='failed' where application_id=applicant_id;
  if public.member_rsvp_deadline(applicant_id) is not null then raise exception 'Failed email started RSVP clock'; end if;
  update public.application_admissions set email_status='sent', decision='rejected' where application_id=applicant_id;
  if public.member_rsvp_deadline(applicant_id) is not null then raise exception 'Rejection started RSVP clock'; end if;
end;
$$;

rollback;
