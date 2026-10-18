-- Run after migrations. All synthetic state is rolled back, including quota counts.
begin;
do $tests$
declare
  test_guild text := '9999999999999999900';
  test_channel text := '9999999999999999901';
  human_id text := '9999999999999999902';
  root_id text := '9999999999999999910';
  parent_id text := root_id;
  next_id text;
  bot text;
  peer text;
  result text;
  turn integer;
begin
  -- A single human can mention both bots; deduplication is per bot.
  assert public.claim_discord_overlord_request(root_id, test_guild, human_id, test_channel, 'bob') = 'accepted';
  assert public.claim_discord_overlord_request(root_id, test_guild, human_id, test_channel, 'rick') = 'accepted';
  assert public.claim_discord_overlord_request(root_id, test_guild, human_id, test_channel, 'bob') = 'duplicate';
  assert (select count(*) from public.discord_bot_requests where guild_id = test_guild) = 2;

  -- A peer cannot start from an untracked or cross-channel parent.
  assert public.claim_discord_overlord_request('9999999999999999911', test_guild, '9999999999999999921', test_channel, 'rick',
    p_peer_bot_id => 'bob', p_parent_message_id => '9999999999999999999') = 'conversation_limit';
  assert public.claim_discord_overlord_request('9999999999999999911', test_guild, '9999999999999999921', '9999999999999999998', 'rick',
    p_peer_bot_id => 'bob', p_parent_message_id => root_id) = 'conversation_limit';

  -- Six replies per chain including the human-triggered reply, then silence.
  for turn in 1..6 loop
    bot := case when turn % 2 = 1 then 'rick' else 'bob' end;
    peer := case when bot = 'rick' then 'bob' else 'rick' end;
    next_id := (9999999999999999930::numeric + turn)::text;
    update public.discord_bot_requests set status = 'answered', created_at = now() - interval '4 seconds' where guild_id = test_guild;
    result := public.claim_discord_overlord_request(next_id, test_guild, '9999999999999999921', test_channel, bot,
      p_peer_bot_id => peer, p_parent_message_id => parent_id);
    if turn <= 5 then
      assert result = 'accepted', 'Peer turn must be accepted';
      assert (select conversation_depth from public.discord_bot_requests where bot_id = bot and message_id = next_id) = turn;
    else
      assert result = 'conversation_limit', 'A seventh reply must not be admitted';
    end if;
    parent_id := next_id;
  end loop;

  -- Image attempts are once per request, only for human roots, and share a budget.
  update public.discord_bot_requests set status = 'processing', created_at = now() where guild_id = test_guild;
  assert public.claim_discord_bot_image(root_id, 'bob') = 'accepted';
  assert public.claim_discord_bot_image(root_id, 'bob') = 'duplicate';
  assert public.claim_discord_bot_image(root_id, 'rick') = 'cooldown';
  assert public.claim_discord_bot_image('9999999999999999931', 'rick') = 'forbidden';
  assert public.claim_discord_overlord_request('9999999999999999950', test_guild, '9999999999999999951', test_channel, 'bob') = 'accepted';
  assert public.claim_discord_bot_image('9999999999999999950', 'bob', 1) = 'daily_limit';

  -- New functions remain private and retain invoker privileges.
  assert not has_function_privilege('anon', 'public.claim_discord_bot_image(text,text,integer)', 'execute');
  assert not has_function_privilege('authenticated', 'public.claim_discord_overlord_request(text,text,text,text,text,integer,integer,integer,text,text)', 'execute');
  assert has_function_privilege('service_role', 'public.claim_discord_bot_image(text,text,integer)', 'execute');
  assert not (select prosecdef from pg_proc where oid = 'public.claim_discord_bot_image(text,text,integer)'::regprocedure);
end;
$tests$;
rollback;
