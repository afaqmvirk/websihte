-- A member can decline before submitting travel details or participation forms.
alter table public.member_rsvps
  alter column is_local drop not null,
  drop constraint member_rsvp_travel_plan,
  add constraint member_rsvp_travel_plan check (
    (is_local is null and travel_plan is null and cancelled_at is not null) or
    (is_local is not null and (
      (is_local and travel_plan is null) or
      (not is_local and travel_plan is not null and char_length(btrim(travel_plan)) between 1 and 2000)
    ))
  );

comment on column public.member_rsvps.is_local is
  'Null only when the member declined without submitting an RSVP. Active RSVPs require a travel answer.';

create or replace function public.cancel_member_rsvp(p_application_id uuid, p_email text)
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

  -- The upsert records an immediate decline without inventing travel answers.
  -- Existing answers and the first cancellation timestamp are preserved.
  -- Withdrawal is still allowed after the RSVP deadline.
  return query insert into public.member_rsvps as r (application_id, is_local, travel_plan, cancelled_at)
    values (p_application_id, null, null, clock_timestamp())
    on conflict (application_id) do update set
      cancelled_at = coalesce(r.cancelled_at, excluded.cancelled_at),
      updated_at = case when r.cancelled_at is null then clock_timestamp() else r.updated_at end
    returning r.is_local, r.travel_plan, r.updated_at, r.cancelled_at;
end;
$$;

revoke all on function public.cancel_member_rsvp(uuid,text) from public, anon, authenticated;
grant execute on function public.cancel_member_rsvp(uuid,text) to service_role;
