create table public.discord_bot_requests (
  message_id text primary key check (message_id ~ '^[0-9]{17,20}$'),
  guild_id text not null check (guild_id ~ '^[0-9]{17,20}$'),
  user_id text not null check (user_id ~ '^[0-9]{17,20}$'),
  created_at timestamptz not null default now(),
  status text not null default 'processing' check (status in ('processing', 'answered', 'failed')),
  reply_message_id text
);
create index discord_bot_requests_guild_created_idx on public.discord_bot_requests (guild_id, created_at);
create index discord_bot_requests_user_created_idx on public.discord_bot_requests (guild_id, user_id, created_at desc);
alter table public.discord_bot_requests enable row level security;
revoke all on public.discord_bot_requests from public, anon, authenticated;
grant select, insert, update, delete on public.discord_bot_requests to service_role;

create function public.claim_discord_bot_request(
  p_message_id text, p_guild_id text, p_user_id text,
  p_daily_limit integer default 100, p_cooldown_seconds integer default 15
) returns text language plpgsql security invoker set search_path = '' as $$
begin
  if p_message_id !~ '^[0-9]{17,20}$' or p_guild_id !~ '^[0-9]{17,20}$'
    or p_user_id !~ '^[0-9]{17,20}$' or p_daily_limit not between 1 and 1000
    or p_cooldown_seconds not between 1 and 3600 then
    raise exception 'Invalid bot request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sih-inator:' || p_guild_id, 0));
  delete from public.discord_bot_requests where created_at < now() - interval '2 days';
  if exists (select 1 from public.discord_bot_requests where message_id = p_message_id) then
    return 'duplicate';
  end if;
  if (select count(*) from public.discord_bot_requests
      where guild_id = p_guild_id and created_at >= date_trunc('day', now(), 'UTC')) >= p_daily_limit then
    return 'daily_limit';
  end if;
  if exists (select 1 from public.discord_bot_requests
      where guild_id = p_guild_id and user_id = p_user_id
        and created_at > now() - make_interval(secs => p_cooldown_seconds)) then
    return 'cooldown';
  end if;
  insert into public.discord_bot_requests (message_id, guild_id, user_id)
    values (p_message_id, p_guild_id, p_user_id);
  return 'accepted';
end;
$$;
revoke all on function public.claim_discord_bot_request(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_discord_bot_request(text, text, text, integer, integer) to service_role;

comment on table public.discord_bot_requests is
  'Private sih-inator deduplication and quota metadata. No prompts or replies are stored. Expired metadata is removed during the next request.';
