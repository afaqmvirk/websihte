-- Synthetic data only; every write is rolled back, and no mail/storage API is called.
begin;
do $$
declare
  actor uuid:=gen_random_uuid(); disabled uuid:=gen_random_uuid(); app uuid:=gen_random_uuid(); fresh uuid:=gen_random_uuid();
  email text:=app::text||'@consent-test.invalid'; ticket uuid; upload uuid; previous uuid;
begin
  insert into auth.users(id,email,email_confirmed_at) values(actor,actor::text||'@consent-test.invalid',now()),(disabled,disabled::text||'@consent-test.invalid',now());
  insert into private.organizer_reviewers(user_id,email,enabled,can_view_all_reviews) values(actor,actor::text||'@consent-test.invalid',true,false),(disabled,disabled::text||'@consent-test.invalid',false,false);
  insert into public.applications(id,submission_hash,event_slug,full_name,email,affiliation,tshirt_size,dietary_restrictions,linkedin_url,stupidest_thing,coolest_build,attending,privacy_policy_version,intake_status,admission_status)
    values(app,repeat(replace(app::text,'-',''),2),'ottawa-2026','Synthetic Consent',email,'Test','M','none','https://example.invalid','Test','Test',true,'test','complete','accepted'),
      (fresh,repeat(replace(fresh::text,'-',''),2),'ottawa-2026','Synthetic New Consent',fresh::text||'@consent-test.invalid','Test','M','none','https://example.invalid','Test','Test',true,'test','complete','accepted');
  insert into public.application_admissions(application_id,decision,notification_id,decided_by,email_status,email_payload,email_sent_at)
    values(app,'accepted',gen_random_uuid(),actor,'sent','{}',now()-interval '10 days'),(fresh,'accepted',gen_random_uuid(),actor,'sent','{}',now());
  insert into public.member_rsvps(application_id,is_local) values(app,true) returning qr_token into ticket;
  if public.member_rsvp_consent_ready(app) then raise exception 'Legacy RSVP falsely accepted'; end if;
  begin
    perform public.save_member_rsvp_with_consent(fresh,fresh::text||'@consent-test.invalid',true,null,true,'Synthetic New',true,false,false);
    raise exception 'Missing required agreement accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.member_rsvps where application_id=fresh) then raise exception 'Invalid consent did not roll back RSVP'; end if;
  begin
    perform public.record_member_consent(app,'wrong@consent-test.invalid',true,'Synthetic Consent',true,true,false);
    raise exception 'Wrong owner saved consent';
  exception when insufficient_privilege then null; end;
  perform public.record_member_consent(app,email,true,'Synthetic Consent',true,true,false);
  if not public.member_rsvp_consent_ready(app) then raise exception 'Adult late form completion failed'; end if;
  begin
    perform public.save_member_rsvp(app,email,false,'Late changed travel'); raise exception 'Late travel change allowed';
  exception when raise_exception then if sqlerrm<>'member_rsvp_closed' then raise; end if; end;
  perform public.record_member_consent(app,email,false,'Synthetic Consent',true,true,false);
  if public.organizer_lookup_rsvp(actor,ticket)->>'status'<>'consent_required' then raise exception 'Minor bypassed guardian form'; end if;
  perform public.record_guardian_upload(app,email,app::text||'/'||gen_random_uuid()::text||'.pdf','signed-parent.pdf','application/pdf',100,repeat('a',64));
  select guardian_upload_id into upload from public.member_rsvps where application_id=app;
  if public.member_rsvp_consent_ready(app) then raise exception 'Upload auto-approved'; end if;
  begin
    perform public.organizer_check_in_rsvp(actor,ticket,true); raise exception 'Pending form checked in';
  exception when raise_exception then if sqlerrm<>'check_in_consent_required' then raise; end if; end;
  begin
    perform public.organizer_review_guardian_upload(disabled,app,upload,true,'',false,true); raise exception 'Disabled reviewer approved';
  exception when insufficient_privilege then null; end;
  begin
    perform public.organizer_review_guardian_upload(actor,app,upload,true,'',false,false); raise exception 'Review lacked confirmation';
  exception when invalid_parameter_value then null; end;
  perform public.organizer_review_guardian_upload(actor,app,upload,true,'',false,true);
  if not public.member_rsvp_consent_ready(app) or (select checked_in_at is not null from public.member_rsvps where application_id=app)
    then raise exception 'Approval did not clear forms or auto-checked in'; end if;
  begin
    perform public.organizer_review_guardian_upload(actor,app,upload,false,'Changed my mind',false,true); raise exception 'Completed review overwritten';
  exception when raise_exception then if sqlerrm<>'guardian_review_stale' then raise; end if; end;
  previous:=upload;
  perform public.record_guardian_upload(app,email,app::text||'/'||gen_random_uuid()::text||'.png','replacement.png','image/png',100,repeat('b',64));
  select guardian_upload_id into upload from public.member_rsvps where application_id=app;
  if upload=previous or public.member_rsvp_consent_ready(app) then raise exception 'Replacement reused approval'; end if;
  begin
    perform public.organizer_review_guardian_upload(actor,app,previous,true,'',false,true); raise exception 'Stale upload approved';
  exception when raise_exception then if sqlerrm<>'guardian_review_stale' then raise; end if; end;
  perform public.organizer_review_guardian_upload(actor,app,upload,false,'Signature is missing.',false,true);
  if (select guardian_review_note from public.member_rsvps where application_id=app)<>'Signature is missing.' or public.member_rsvp_consent_ready(app)
    then raise exception 'Rejection/feedback not saved'; end if;
  perform public.record_guardian_upload(app,email,app::text||'/'||gen_random_uuid()::text||'.jpg','replacement.jpg','image/jpeg',100,repeat('c',64));
  select guardian_upload_id into upload from public.member_rsvps where application_id=app;
  perform public.organizer_review_guardian_upload(actor,app,upload,true,'',true,true);
  perform public.record_member_consent(app,email,false,'Different Name',true,true,true);
  if public.member_rsvp_consent_ready(app) or (select count(*) from public.member_guardian_uploads where application_id=app)<>3
    then raise exception 'Name change kept approval or deleted audit history'; end if;
  perform public.record_guardian_upload(app,email,app::text||'/'||gen_random_uuid()::text||'.pdf','correct-name.pdf','application/pdf',100,repeat('d',64));
  select guardian_upload_id into upload from public.member_rsvps where application_id=app;
  perform public.organizer_review_guardian_upload(actor,app,upload,true,'',false,true);
  if (select guardian_media_consent from public.member_rsvps where application_id=app) then raise exception 'Optional media defaulted yes'; end if;
  if public.organizer_check_in_rsvp(actor,ticket,true)->>'status'<>'checked_in' then raise exception 'Explicit check-in failed'; end if;
  perform public.cancel_member_rsvp(app,email);
  if (select cancelled_at is null from public.member_rsvps where application_id=app) then raise exception 'Late cancellation blocked'; end if;
  begin
    perform public.record_member_consent(app,email,true,'Synthetic Consent',true,true,false); raise exception 'Forms reactivated RSVP';
  exception when raise_exception then if sqlerrm<>'member_rsvp_inactive' then raise; end if; end;
  if exists(select 1 from public.participant_document_versions where digest<>encode(sha256(convert_to(documents,'UTF8')),'hex')) then raise exception 'Document evidence digest mismatch'; end if;
  if has_table_privilege('anon','public.member_guardian_uploads','select') or has_table_privilege('authenticated','public.member_guardian_uploads','insert')
    or has_function_privilege('authenticated','public.organizer_review_guardian_upload(uuid,uuid,uuid,boolean,text,boolean,boolean)','execute')
    or has_function_privilege('anon','public.record_guardian_upload(uuid,text,text,text,text,integer,text)','execute')
    or (select public from storage.buckets where id='participant-consents') then raise exception 'Private forms exposed'; end if;
end $$;
rollback;
select true as participant_and_parent_upload_flow_verified;
