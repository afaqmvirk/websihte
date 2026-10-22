alter table public.applications
  add column admission_status text not null default 'pending'
  check (admission_status in ('pending', 'accepted', 'waitlisted', 'rejected'));

comment on column public.applications.admission_status is
  'Organizer-controlled admission decision. The latest complete application for an email and event determines portal access. No decision emails are sent automatically.';

create index applications_portal_lookup_idx
  on public.applications (event_slug, email, created_at desc, id desc)
  where intake_status = 'complete';

create table public.member_rsvps (
  application_id uuid primary key references public.applications(id) on delete cascade,
  is_local boolean not null,
  travel_plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_rsvp_travel_plan check (
    (is_local and travel_plan is null) or
    (not is_local and travel_plan is not null and char_length(btrim(travel_plan)) between 1 and 2000)
  )
);

alter table public.member_rsvps enable row level security;
revoke all on public.member_rsvps from public, anon, authenticated;
grant select, insert, update, delete on public.member_rsvps to service_role;

comment on table public.member_rsvps is
  'Private accepted-member RSVPs. Access is checked server-side against verified identity and the current admission decision.';

create function public.save_member_rsvp(
  p_application_id uuid, p_email text, p_is_local boolean, p_travel_plan text
)
returns table (is_local boolean, travel_plan text, updated_at timestamptz)
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

  return query insert into public.member_rsvps as r (application_id, is_local, travel_plan)
    values (p_application_id, p_is_local, case when p_is_local then null else btrim(p_travel_plan) end)
    on conflict (application_id) do update set
      is_local = excluded.is_local, travel_plan = excluded.travel_plan, updated_at = now()
    returning r.is_local, r.travel_plan, r.updated_at;
end;
$$;

revoke all on function public.save_member_rsvp(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.save_member_rsvp(uuid, text, boolean, text) to service_role;

create table public.portal_sign_in_limits (
  key text primary key,
  attempts integer not null default 1 check (attempts > 0),
  expires_at timestamptz not null
);

alter table public.portal_sign_in_limits enable row level security;
revoke all on public.portal_sign_in_limits from public, anon, authenticated;
grant select, insert, update, delete on public.portal_sign_in_limits to service_role;

comment on table public.portal_sign_in_limits is
  'Short-lived counters for portal email abuse prevention. Stores SHA-256 hashes of email and IP, never raw addresses. Removed after expiry on subsequent sign-in attempts.';

create function public.claim_portal_sign_in(p_email_hash text, p_ip_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_keys text[];
  v_limits integer[] := array[1, 5, 30];
  v_claimed text;
  v_i integer;
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$'
    or p_email_hash is null or p_ip_hash is null then return false; end if;
  delete from public.portal_sign_in_limits where expires_at < v_now;
  v_keys := array[
    'email-minute:' || p_email_hash || ':' || pg_catalog.date_trunc('minute', v_now)::text,
    'email-hour:' || p_email_hash || ':' || pg_catalog.date_trunc('hour', v_now)::text,
    'ip-hour:' || p_ip_hash || ':' || pg_catalog.date_trunc('hour', v_now)::text
  ];
  -- Every request consumes its IP budget, including requests for unknown emails.
  for v_i in reverse 3..1 loop
    v_claimed := null;
    insert into public.portal_sign_in_limits as l (key, expires_at)
      values (v_keys[v_i], v_now + interval '2 hours')
      on conflict (key) do update set attempts = l.attempts + 1
      where l.attempts < v_limits[v_i]
      returning key into v_claimed;
    if v_claimed is null then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.claim_portal_sign_in(text, text) from public, anon, authenticated;
grant execute on function public.claim_portal_sign_in(text, text) to service_role;
