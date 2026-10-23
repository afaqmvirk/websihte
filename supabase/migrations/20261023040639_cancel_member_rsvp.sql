alter table public.member_rsvps add column cancelled_at timestamptz;
comment on column public.member_rsvps.cancelled_at is
  'Null means attending. A cancellation retains the original RSVP and travel details; a new RSVP before the deadline clears this timestamp.';

create function public.cancel_member_rsvp(p_application_id uuid, p_email text)
returns table (is_local boolean, travel_plan text, updated_at timestamptz, cancelled_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_application_id uuid;
begin
  select a.id into v_application_id from public.applications a
    where a.event_slug = 'ottawa-2026' and a.email = lower(btrim(p_email))
      and a.intake_status = 'complete'
    order by a.created_at desc, a.id desc limit 1;

  perform 1 from public.applications a
    where a.id = p_application_id and a.id = v_application_id
      and a.admission_status = 'accepted' for share;
  if not found then
    raise exception 'Accepted application required' using errcode = '42501';
  end if;

  -- Cancellation deliberately has no deadline check. Repeated requests preserve
  -- the first cancellation timestamp and never delete the saved answers.
  return query update public.member_rsvps as r set
    cancelled_at = coalesce(r.cancelled_at, clock_timestamp()),
    updated_at = case when r.cancelled_at is null then clock_timestamp() else r.updated_at end
    where r.application_id = p_application_id
    returning r.is_local, r.travel_plan, r.updated_at, r.cancelled_at;
end;
$$;

revoke all on function public.cancel_member_rsvp(uuid,text) from public, anon, authenticated;
grant execute on function public.cancel_member_rsvp(uuid,text) to service_role;

-- RSVP again uses the existing deadline and acceptance checks, with the same
-- RPC signature so current clients can continue to save during deployment.
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
      is_local = excluded.is_local, travel_plan = excluded.travel_plan,
      updated_at = now(), cancelled_at = null
    returning r.is_local, r.travel_plan, r.updated_at;
end;
$$;

revoke all on function public.save_member_rsvp(uuid,text,boolean,text) from public, anon, authenticated;
grant execute on function public.save_member_rsvp(uuid,text,boolean,text) to service_role;
