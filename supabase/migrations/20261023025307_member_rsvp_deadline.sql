-- Requires sih-organizer's 20261022060736_organizer_admission_decisions.sql.
-- Acceptance emails are sent individually; every applicant gets seven full
-- calendar days after their acceptance date, ending at midnight in Ottawa.
create function public.member_rsvp_deadline(p_application_id uuid)
returns timestamptz
language sql stable security invoker set search_path = '' as $$
  select ((n.email_sent_at at time zone 'America/Toronto')::date + 8)::timestamp
    at time zone 'America/Toronto'
  from public.application_admissions n
  join public.applications a on a.id = n.application_id
  where n.application_id = p_application_id and n.decision = 'accepted'
    and n.email_status = 'sent' and n.email_sent_at is not null
    and a.admission_status = 'accepted' and a.event_slug = 'ottawa-2026'
    and a.intake_status = 'complete';
$$;

revoke all on function public.member_rsvp_deadline(uuid) from public, anon, authenticated;
grant execute on function public.member_rsvp_deadline(uuid) to service_role;

create or replace function public.save_member_rsvp(
  p_application_id uuid, p_email text, p_is_local boolean, p_travel_plan text
)
returns table (is_local boolean, travel_plan text, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  v_application_id uuid;
  v_deadline timestamptz;
begin
  select a.id into v_application_id from public.applications a
    where a.event_slug = 'ottawa-2026' and a.email = lower(btrim(p_email))
      and a.intake_status = 'complete'
    order by a.created_at desc, a.id desc limit 1;

  -- This also serializes against organizer decision/email state changes, which
  -- lock the application before updating application_admissions.
  perform 1 from public.applications a
    where a.id = p_application_id and a.id = v_application_id
      and a.admission_status = 'accepted' for share;
  if not found then
    raise exception 'Accepted application required' using errcode = '42501';
  end if;

  v_deadline := public.member_rsvp_deadline(p_application_id);
  if v_deadline is null then
    raise exception 'member_rsvp_not_open' using errcode = 'P0001';
  end if;
  if clock_timestamp() >= v_deadline then
    raise exception 'member_rsvp_closed' using errcode = 'P0001';
  end if;

  return query insert into public.member_rsvps as r (application_id, is_local, travel_plan)
    values (p_application_id, p_is_local, case when p_is_local then null else btrim(p_travel_plan) end)
    on conflict (application_id) do update set
      is_local = excluded.is_local, travel_plan = excluded.travel_plan, updated_at = now()
    returning r.is_local, r.travel_plan, r.updated_at;
end;
$$;

revoke all on function public.save_member_rsvp(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.save_member_rsvp(uuid, text, boolean, text) to service_role;
