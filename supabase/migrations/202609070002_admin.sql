ALTER TABLE public.prompt_usage ADD COLUMN IF NOT EXISTS public_ip text NOT NULL DEFAULT 'unknown';
CREATE INDEX IF NOT EXISTS prompt_usage_ip_idx ON public.prompt_usage (public_ip, created_at DESC);
DROP FUNCTION IF EXISTS public.record_prompt_usage(uuid,text,text,jsonb,integer,text);
CREATE OR REPLACE FUNCTION public.record_prompt_usage(
  event_id uuid, event_feature text, event_prompt text, event_result jsonb,
  event_duration_ms integer, event_rate_key text, event_ip text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Serialize writes so concurrent requests cannot bypass the per-minute cap.
  PERFORM pg_advisory_xact_lock(716234902);
  IF EXISTS (SELECT 1 FROM prompt_usage WHERE id = event_id) THEN RETURN 'duplicate'; END IF;
  -- Stop recording before usage history exhausts the free database allocation.
  IF pg_total_relation_size('public.prompt_usage') > 300 * 1024 * 1024 THEN RETURN 'limited'; END IF;
  IF (SELECT count(*) FROM prompt_usage WHERE rate_key = event_rate_key
      AND created_at > now() - interval '1 minute') >= 30 THEN RETURN 'limited'; END IF;
  INSERT INTO prompt_usage (id, feature, prompt, result, duration_ms, rate_key, public_ip)
    VALUES (event_id, event_feature, event_prompt, event_result, event_duration_ms, event_rate_key, event_ip);
  RETURN 'saved';
END;
$$;
REVOKE ALL ON FUNCTION public.record_prompt_usage(uuid,text,text,jsonb,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_prompt_usage(uuid,text,text,jsonb,integer,text,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  rate_key text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL
);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_login_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_attempts TO service_role;
CREATE OR REPLACE FUNCTION public.admin_login_allowed(attempt_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE attempt_count integer;
BEGIN
  DELETE FROM admin_login_attempts WHERE window_start < now() - interval '1 day';
  INSERT INTO admin_login_attempts VALUES (attempt_key, now(), 1)
  ON CONFLICT (rate_key) DO UPDATE SET
    attempts = CASE WHEN admin_login_attempts.window_start < now() - interval '15 minutes' THEN 1 ELSE admin_login_attempts.attempts + 1 END,
    window_start = CASE WHEN admin_login_attempts.window_start < now() - interval '15 minutes' THEN now() ELSE admin_login_attempts.window_start END
  RETURNING attempts INTO attempt_count;
  RETURN attempt_count <= 5;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_login_allowed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_login_allowed(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_ip_groups(page_offset integer DEFAULT 0)
RETURNS TABLE(public_ip text, submissions bigint, last_seen timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT public_ip, count(*) AS submissions, max(created_at) AS last_seen
  FROM prompt_usage GROUP BY public_ip ORDER BY last_seen DESC, public_ip
  LIMIT 31 OFFSET greatest(page_offset, 0);
$$;
REVOKE ALL ON FUNCTION public.admin_ip_groups(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ip_groups(integer) TO service_role;
