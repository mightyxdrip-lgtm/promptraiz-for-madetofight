CREATE OR REPLACE FUNCTION public.admin_usage_stats()
RETURNS TABLE(visitors bigint, submissions bigint)
LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$
 SELECT count(DISTINCT public_ip) FILTER (WHERE public_ip <> 'unknown'), count(*) FROM prompt_usage;
$$;
REVOKE ALL ON FUNCTION public.admin_usage_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_stats() TO service_role;
