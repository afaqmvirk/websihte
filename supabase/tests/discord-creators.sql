-- No source, prompts, or generated files in quota storage. Roll back all fixtures.
begin;
do $tests$
declare
  guild text := '9999999999999998800';
  channel text := '9999999999999998801';
  human text := '9999999999999998802';
  root text := '9999999999999998810';
begin
  assert public.claim_discord_overlord_request(root, guild, human, channel, 'sand') = 'accepted';
  assert public.claim_discord_overlord_request(root, guild, human, channel, 'plank') = 'accepted';
  assert public.claim_discord_bot_render(root, 'sand') = 'accepted';
  assert public.claim_discord_bot_render(root, 'sand') = 'duplicate';
  assert public.claim_discord_bot_render(root, 'plank') = 'cooldown';
  assert public.claim_discord_bot_render('9999999999999998899', 'sand') = 'forbidden';
  assert public.claim_discord_overlord_request('9999999999999998811', guild, '9999999999999998803', channel, 'plank',
    p_peer_bot_id => 'sand', p_parent_message_id => root) = 'accepted';
  assert public.claim_discord_bot_render('9999999999999998811', 'plank') = 'forbidden';
  assert public.claim_discord_overlord_request('9999999999999998812', guild, '9999999999999998804', channel, 'plank') = 'accepted';
  assert public.claim_discord_bot_render('9999999999999998812', 'plank', 1) = 'daily_limit';
  assert public.claim_discord_bot_render('9999999999999998812', 'plank') = 'accepted';
  assert public.claim_discord_overlord_request('9999999999999998813', guild, '9999999999999998805', channel, 'sand') = 'accepted';
  update public.discord_bot_requests set status = 'answered' where bot_id = 'sand' and message_id = '9999999999999998813';
  assert public.claim_discord_bot_render('9999999999999998813', 'sand') = 'forbidden';
  assert public.claim_discord_overlord_request('9999999999999998814', guild, '9999999999999998806', channel, 'sand') = 'accepted';
  update public.discord_bot_requests set created_at = now() - interval '4 minutes' where bot_id = 'sand' and message_id = '9999999999999998814';
  assert public.claim_discord_bot_render('9999999999999998814', 'sand') = 'forbidden';
  begin
    perform public.claim_discord_bot_render(root, 'bob');
    assert false, 'Other personas cannot render';
  exception when raise_exception then
    assert sqlerrm = 'Invalid render request';
  end;
  assert not has_function_privilege('anon', 'public.claim_discord_bot_render(text,text,integer)', 'execute');
  assert not has_function_privilege('authenticated', 'public.claim_discord_bot_render(text,text,integer)', 'execute');
  assert has_function_privilege('service_role', 'public.claim_discord_bot_render(text,text,integer)', 'execute');
  assert not (select prosecdef from pg_proc where oid = 'public.claim_discord_bot_render(text,text,integer)'::regprocedure);
  assert (select relrowsecurity from pg_class where oid = 'public.discord_bot_requests'::regclass);
end;
$tests$;
rollback;
