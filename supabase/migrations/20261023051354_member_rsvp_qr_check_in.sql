-- Tickets stay private with the RSVP; neither browser roles nor public callers
-- gain direct table or function access.
alter table public.member_rsvps
  add column qr_token uuid not null default gen_random_uuid() unique,
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references auth.users(id) on delete set null;
create index member_rsvps_checked_in_by_idx on public.member_rsvps(checked_in_by);
comment on column public.member_rsvps.qr_token is
  'Private stable ticket. QR content is sih:ottawa-2026:<qr_token>; valid only while this is the latest accepted application with an active RSVP.';

alter table public.organizer_audit drop constraint organizer_audit_action_check;
alter table public.organizer_audit add constraint organizer_audit_action_check check (action in (
  'signin_code_requested','signin_success','mfa_verified','queue_viewed','application_viewed',
  'resume_viewed','review_saved','signed_out','admission_accepted','admission_rejected',
  'admission_email_sent','admission_email_failed','rsvp_checked_in'
));

create function public.organizer_lookup_rsvp(reviewer_user_id uuid, ticket_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  applicant public.applications%rowtype;
  rsvp public.member_rsvps%rowtype;
  ticket_status text;
begin
  if not exists (select 1 from private.organizer_reviewers r where r.user_id=reviewer_user_id and r.enabled)
  then raise exception 'Organizer access required' using errcode='42501'; end if;
  select * into rsvp from public.member_rsvps r where r.qr_token=ticket_token;
  if not found then raise exception 'check_in_invalid_ticket' using errcode='P0002'; end if;
  select * into applicant from public.applications a where a.id=rsvp.application_id;
  ticket_status := case
    when applicant.admission_status<>'accepted' or applicant.intake_status<>'complete'
      or applicant.event_slug<>'ottawa-2026' or applicant.id is distinct from (
        select a.id from public.applications a where a.event_slug='ottawa-2026' and a.intake_status='complete'
          and lower(btrim(a.email))=lower(btrim(applicant.email)) order by a.created_at desc,a.id desc limit 1
      ) then 'not_eligible'
    when rsvp.cancelled_at is not null then 'cancelled'
    when rsvp.checked_in_at is not null then 'already_checked_in'
    else 'ready' end;
  return jsonb_build_object('status',ticket_status,'application_id',applicant.id,
    'full_name',applicant.full_name,'email',applicant.email,'affiliation',applicant.affiliation,
    'checked_in_at',rsvp.checked_in_at);
end;
$$;
revoke all on function public.organizer_lookup_rsvp(uuid,uuid) from public,anon,authenticated;
grant execute on function public.organizer_lookup_rsvp(uuid,uuid) to service_role;

create function public.organizer_check_in_rsvp(reviewer_user_id uuid, ticket_token uuid, confirmed boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  application_id uuid;
  applicant public.applications%rowtype;
  rsvp public.member_rsvps%rowtype;
begin
  if not exists (select 1 from private.organizer_reviewers r
    where r.user_id=reviewer_user_id and r.enabled)
  then raise exception 'Organizer access required' using errcode='42501'; end if;
  if confirmed is distinct from true then
    raise exception 'check_in_confirmation_required' using errcode='22023'; end if;

  select r.application_id into application_id from public.member_rsvps r where r.qr_token=ticket_token;
  if application_id is null then raise exception 'check_in_invalid_ticket' using errcode='P0002'; end if;
  -- Use the same lock order as RSVP saves/cancellations: application, then RSVP.
  select * into applicant from public.applications a where a.id=application_id for update;
  if not found then raise exception 'check_in_invalid_ticket' using errcode='P0002'; end if;
  if applicant.admission_status<>'accepted' or applicant.intake_status<>'complete'
    or applicant.event_slug<>'ottawa-2026' or applicant.id is distinct from (
      select a.id from public.applications a where a.event_slug='ottawa-2026' and a.intake_status='complete'
        and lower(btrim(a.email))=lower(btrim(applicant.email)) order by a.created_at desc,a.id desc limit 1
    ) then raise exception 'check_in_not_eligible' using errcode='P0001'; end if;
  select * into rsvp from public.member_rsvps r where r.qr_token=ticket_token for update;
  if not found then raise exception 'check_in_invalid_ticket' using errcode='P0002'; end if;
  if rsvp.cancelled_at is not null then raise exception 'check_in_cancelled' using errcode='P0001'; end if;
  if rsvp.checked_in_at is not null then
    return public.organizer_lookup_rsvp(reviewer_user_id,ticket_token);
  end if;
  update public.member_rsvps r set checked_in_at=clock_timestamp(),checked_in_by=reviewer_user_id
    where r.application_id=applicant.id returning * into rsvp;
  insert into public.organizer_audit(action,actor_id,application_id)
    values('rsvp_checked_in',reviewer_user_id,applicant.id);
  return public.organizer_lookup_rsvp(reviewer_user_id,ticket_token) || '{"status":"checked_in"}'::jsonb;
end;
$$;
revoke all on function public.organizer_check_in_rsvp(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.organizer_check_in_rsvp(uuid,uuid,boolean) to service_role;
