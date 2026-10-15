-- The dashboard's automatic-RLS event trigger needs no access from API clients.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
