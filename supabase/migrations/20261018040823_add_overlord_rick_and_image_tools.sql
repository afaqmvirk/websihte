-- Existing rows and older Bob listeners retain the bob default during handover.
alter table public.discord_bot_requests
  add column bot_id text not null default 'bob' check (bot_id in ('bob', 'rick')),
  add column channel_id text check (channel_id ~ '^[0-9]{17,20}$'),
  add column conversation_depth smallint not null default 0 check (conversation_depth between 0 and 5),
  add column image_requested_at timestamptz;

alter table public.discord_bot_requests drop constraint discord_bot_requests_pkey;
alter table public.discord_bot_requests add primary key (bot_id, message_id);
create index discord_bot_requests_images_idx on public.discord_bot_requests (guild_id, image_requested_at desc)
  where image_requested_at is not null;

create function public.claim_discord_overlord_request(
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
    or p_user_id !~ '^[0-9]{17,20}$' or p_channel_id !~ '^[0-9]{17,20}$' or p_bot_id not in ('bob', 'rick')
    or p_daily_limit not between 1 and 10000 or p_cooldown_seconds not between 1 and 3600
    or p_monthly_limit not between 1 and 310000
    or (p_peer_bot_id is not null and (p_peer_bot_id not in ('bob', 'rick') or p_peer_bot_id = p_bot_id)) then
    raise exception 'Invalid bot request';
  end if;
  -- Use the same lock and monthly counter as the existing Bob admission function.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sih-inator:' || p_guild_id, 0));
  delete from public.discord_bot_requests where guild_id = p_guild_id and created_at < now() - interval '2 days';
  delete from public.discord_bot_monthly_usage where guild_id = p_guild_id and month_start < current_month;
  if exists (select 1 from public.discord_bot_requests where bot_id = p_bot_id and message_id = p_message_id) then
    return 'duplicate';
  end if;
  if p_peer_bot_id is not null then
    -- Look up the message the peer was answering, which is claimed BEFORE its reply
    -- reaches Discord. This also works if the reply's delivery tracking is still in flight.
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

create function public.claim_discord_bot_image(p_message_id text, p_bot_id text, p_daily_limit integer default 25)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  request_row public.discord_bot_requests%rowtype;
begin
  if p_message_id is null or p_message_id !~ '^[0-9]{17,20}$' or p_bot_id is null or p_bot_id not in ('bob', 'rick')
    or p_daily_limit is null or p_daily_limit not between 1 and 100 then
    raise exception 'Invalid image request';
  end if;
  select * into request_row from public.discord_bot_requests where bot_id = p_bot_id and message_id = p_message_id;
  if not found then return 'forbidden'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sih-inator:' || request_row.guild_id, 0));
  select * into request_row from public.discord_bot_requests where bot_id = p_bot_id and message_id = p_message_id for update;
  if not found or request_row.status <> 'processing' or request_row.conversation_depth <> 0
    or request_row.created_at < now() - interval '3 minutes' then return 'forbidden'; end if;
  if request_row.image_requested_at is not null then return 'duplicate'; end if;
  if (select count(*) from public.discord_bot_requests
      where guild_id = request_row.guild_id and image_requested_at >= date_trunc('day', now(), 'UTC')) >= p_daily_limit then
    return 'daily_limit';
  end if;
  -- One image per human per minute across both bots; failed provider attempts count too.
  if exists (select 1 from public.discord_bot_requests where guild_id = request_row.guild_id
      and user_id = request_row.user_id and image_requested_at > now() - interval '1 minute') then
    return 'cooldown';
  end if;
  update public.discord_bot_requests set image_requested_at = now() where bot_id = p_bot_id and message_id = p_message_id;
  return 'accepted';
end;
$$;
revoke all on function public.claim_discord_bot_image(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_discord_bot_image(text, text, integer) to service_role;

comment on table public.discord_bot_requests is
  'Private Bob/Rick deduplication, bounded conversation, and image quota metadata. No prompts, replies, or images are stored. Pruned after two days.';
