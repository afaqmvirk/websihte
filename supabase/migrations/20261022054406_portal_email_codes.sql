-- Code guessing has a separate budget from email delivery so a typo can be
-- retried without sending another email or resetting the verification budget.
create or replace function public.claim_portal_code_verification(p_email_hash text, p_ip_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_bucket text := floor(extract(epoch from now()) / 600)::bigint::text;
  v_keys text[];
  v_limits integer[] := array[5, 30];
  v_claimed text;
  v_i integer;
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$'
    or p_email_hash is null or p_ip_hash is null then return false; end if;
  delete from public.portal_sign_in_limits where expires_at < v_now;
  v_keys := array[
    'code-email:' || p_email_hash || ':' || v_bucket,
    'code-ip:' || p_ip_hash || ':' || v_bucket
  ];
  -- Consume the IP budget first, including attempts for unknown emails.
  for v_i in reverse 2..1 loop
    v_claimed := null;
    insert into public.portal_sign_in_limits as l (key, expires_at)
      values (v_keys[v_i], v_now + interval '20 minutes')
      on conflict (key) do update set attempts = l.attempts + 1
      where l.attempts < v_limits[v_i]
      returning key into v_claimed;
    if v_claimed is null then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.claim_portal_code_verification(text, text) from public, anon, authenticated;
grant execute on function public.claim_portal_code_verification(text, text) to service_role;
