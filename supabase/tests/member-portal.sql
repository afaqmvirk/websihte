-- Synthetic fixtures are contained in this transaction and rolled back.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.member_rsvps', 'SELECT')
    or has_table_privilege('authenticated', 'public.member_rsvps', 'UPDATE')
    or has_table_privilege('anon', 'public.portal_sign_in_limits', 'SELECT')
    or has_function_privilege('anon', 'public.save_member_rsvp(uuid,text,boolean,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.claim_portal_sign_in(text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.claim_portal_code_verification(text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.claim_portal_code_verification(text,text)', 'EXECUTE')
  then raise exception 'Private portal data or functions are publicly accessible'; end if;
  if exists (select 1 from pg_class where oid in ('public.member_rsvps'::regclass, 'public.portal_sign_in_limits'::regclass) and not relrowsecurity)
  then raise exception 'Portal RLS must be enabled'; end if;
end;
$$;

set local role service_role;

insert into public.applications (
  id, submission_hash, event_slug, full_name, email, affiliation, tshirt_size,
  dietary_restrictions, linkedin_url, stupidest_thing, coolest_build,
  attending, privacy_policy_version, admission_status
) values (
  '99999999-9999-4999-8999-999999999991', repeat('9', 64), 'ottawa-2026',
  'Synthetic Portal Test', 'portal-sql-test@example.invalid', 'test', 'M', 'none',
  'https://example.invalid', 'test', 'test', true, 'test', 'pending'
);

do $$
declare v_result record; v_i integer;
begin
  begin
    perform * from public.save_member_rsvp('99999999-9999-4999-8999-999999999991', 'portal-sql-test@example.invalid', true, null);
    raise exception 'Pending application was allowed to RSVP';
  exception when insufficient_privilege then null; end;

  update public.applications set admission_status = 'accepted' where id = '99999999-9999-4999-8999-999999999991';
  begin
    perform * from public.save_member_rsvp('99999999-9999-4999-8999-999999999991', 'someone-else@example.invalid', true, null);
    raise exception 'Wrong email was allowed to RSVP';
  exception when insufficient_privilege then null; end;

  begin
    perform * from public.save_member_rsvp('99999999-9999-4999-8999-999999999991', 'portal-sql-test@example.invalid', false, '   ');
    raise exception 'Empty travel plan was allowed';
  exception when check_violation then null; end;

  begin
    perform * from public.save_member_rsvp('99999999-9999-4999-8999-999999999991', 'portal-sql-test@example.invalid', false, repeat('x', 2001));
    raise exception 'Oversized travel plan was allowed';
  exception when check_violation then null; end;

  select * into v_result from public.save_member_rsvp('99999999-9999-4999-8999-999999999991', 'portal-sql-test@example.invalid', false, ' train from Toronto ');
  if v_result.is_local or v_result.travel_plan <> 'train from Toronto' then raise exception 'Travel RSVP did not save'; end if;
  select * into v_result from public.save_member_rsvp('99999999-9999-4999-8999-999999999991', 'portal-sql-test@example.invalid', true, 'stale plan');
  if not v_result.is_local or v_result.travel_plan is not null then raise exception 'Local RSVP retained travel details'; end if;
  if (select count(*) from public.member_rsvps where application_id = '99999999-9999-4999-8999-999999999991') <> 1 then raise exception 'Edits created duplicate RSVPs'; end if;

  update public.applications set admission_status = 'rejected' where id = '99999999-9999-4999-8999-999999999991';
  begin
    perform * from public.save_member_rsvp('99999999-9999-4999-8999-999999999991', 'portal-sql-test@example.invalid', true, null);
    raise exception 'Revoked acceptance was allowed to RSVP';
  exception when insufficient_privilege then null; end;

  if not public.claim_portal_sign_in(repeat('1',64), repeat('2',64)) then raise exception 'First email request blocked'; end if;
  if public.claim_portal_sign_in(repeat('1',64), repeat('2',64)) then raise exception 'Rapid duplicate email allowed'; end if;
  if public.claim_portal_sign_in('invalid', repeat('2',64)) then raise exception 'Invalid hash accepted'; end if;

  for v_i in 1..5 loop
    if not public.claim_portal_code_verification(repeat('3',64), repeat('4',64)) then raise exception 'Code retry blocked early'; end if;
  end loop;
  if public.claim_portal_code_verification(repeat('3',64), repeat('4',64)) then raise exception 'Email code limit exceeded'; end if;
  if public.claim_portal_code_verification('invalid', repeat('4',64)) then raise exception 'Invalid code rate-limit hash accepted'; end if;
  for v_i in 1..30 loop
    if not public.claim_portal_code_verification(lpad(to_hex(v_i),64,'0'), repeat('5',64)) then raise exception 'Code IP limit blocked early'; end if;
  end loop;
  if public.claim_portal_code_verification(repeat('6',64), repeat('5',64)) then raise exception 'Code IP limit exceeded'; end if;
end;
$$;

reset role;
rollback;
