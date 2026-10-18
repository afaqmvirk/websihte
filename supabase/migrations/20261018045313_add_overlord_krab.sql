alter table public.discord_bot_requests
  drop constraint discord_bot_requests_bot_id_check;
alter table public.discord_bot_requests
  add constraint discord_bot_requests_bot_id_check check (bot_id in ('bob', 'rick', 'krab'));

create or replace function public.claim_discord_overlord_request(
  p_message_id text, p_guild_id text, p_user_id text, p_channel_id text, p_bot_id text,
  p_daily_limit integer default 10000, p_cooldown_seconds integer default 2,
  p_monthly_limit integer default 310000, p_peer_bot_id text default null, p_parent_message_id text default null
) returns text language plpgsql security invoker set search_path = '' as $$
declare
  current_month date := date_trunc('month', now() at time zone 'UTC')::date;
  request_depth integer := 0;
begin
  if p_message_id is null or p_guild_id is null or p_user_id is null or p_channel_id is null or p_bot_id is null
    or p_daily_limit is null or p_cooldown_seconds is null or p_monthly_limit is null
    or p_message_id !~ '^[0-9]{17,20}$' or p_guild_id !~ '^[0-9]{17,20}$'
    or p_user_id !~ '^[0-9]{17,20}$' or p_channel_id !~ '^[0-9]{17,20}$' or p_bot_id not in ('bob', 'rick', 'krab')
    or p_daily_limit not between 1 and 10000 or p_cooldown_seconds not between 1 and 3600
    or p_monthly_limit not between 1 and 310000
    or (p_peer_bot_id is not null and (p_peer_bot_id not in ('bob', 'rick', 'krab') or p_peer_bot_id = p_bot_id)) then
    raise exception 'Invalid bot request';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sih-inator:' || p_guild_id, 0));
  delete from public.discord_bot_requests where guild_id = p_guild_id and created_at < now() - interval '2 days';
  delete from public.discord_bot_monthly_usage where guild_id = p_guild_id and month_start < current_month;
  if exists (select 1 from public.discord_bot_requests where bot_id = p_bot_id and message_id = p_message_id) then
    return 'duplicate';
  end if;
  if p_peer_bot_id is not null then
    select conversation_depth + 1 into request_depth from public.discord_bot_requests
      where bot_id = p_peer_bot_id and message_id = p_parent_message_id
        and guild_id = p_guild_id and channel_id = p_channel_id;
    if not found or request_depth > 5 then return 'conversation_limit'; end if;
  end if;
  if (select count(*) from public.discord_bot_requests
      where guild_id = p_guild_id and created_at >= date_trunc('day', now(), 'UTC')) >= p_daily_limit then
    return 'daily_limit';
  end if;
  if exists (select 1 from public.discord_bot_requests
      where bot_id = p_bot_id and guild_id = p_guild_id and user_id = p_user_id
        and (created_at > now() - make_interval(secs => p_cooldown_seconds)
          or (status = 'processing' and created_at > now() - interval '3 minutes'))) then
    return 'cooldown';
  end if;
  insert into public.discord_bot_monthly_usage (guild_id, month_start)
    values (p_guild_id, current_month) on conflict do nothing;
  update public.discord_bot_monthly_usage set request_count = request_count + 1
    where guild_id = p_guild_id and month_start = current_month and request_count < p_monthly_limit;
  if not found then return 'monthly_limit'; end if;
  insert into public.discord_bot_requests (bot_id, message_id, guild_id, channel_id, user_id, conversation_depth)
    values (p_bot_id, p_message_id, p_guild_id, p_channel_id, p_user_id, request_depth);
  return 'accepted';
end;
$$;
revoke all on function public.claim_discord_overlord_request(text, text, text, text, text, integer, integer, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_discord_overlord_request(text, text, text, text, text, integer, integer, integer, text, text)
  to service_role;

comment on table public.discord_bot_requests is
  'Private Bob/Rick/Krab deduplication, bounded conversation, and image quota metadata. No prompts, replies, or images are stored. Pruned after two days.';
