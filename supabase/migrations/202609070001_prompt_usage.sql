CREATE TABLE IF NOT EXISTS public.prompt_usage (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  feature text NOT NULL CHECK (feature IN ('audit', 'optimize', 'enhance', 'image-to-prompt')),
  prompt text NOT NULL,
  result jsonb NOT NULL,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  source text NOT NULL DEFAULT 'client_reported',
  rate_key text NOT NULL
);
CREATE INDEX IF NOT EXISTS prompt_usage_created_idx ON public.prompt_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS prompt_usage_rate_idx ON public.prompt_usage (rate_key, created_at);
ALTER TABLE public.prompt_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prompt_usage FROM anon, authenticated;
GRANT SELECT, INSERT ON public.prompt_usage TO service_role;

CREATE OR REPLACE FUNCTION public.record_prompt_usage(
  event_id uuid, event_feature text, event_prompt text, event_result jsonb,
  event_duration_ms integer, event_rate_key text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Serialize writes so concurrent requests cannot bypass the per-minute cap.
  PERFORM pg_advisory_xact_lock(716234902);
  IF EXISTS (SELECT 1 FROM prompt_usage WHERE id = event_id) THEN RETURN 'duplicate'; END IF;
  -- Stop recording before usage history exhausts the free database allocation.
  IF pg_total_relation_size('public.prompt_usage') > 300 * 1024 * 1024 THEN RETURN 'limited'; END IF;
  IF (SELECT count(*) FROM prompt_usage WHERE rate_key = event_rate_key
      AND created_at > now() - interval '1 minute') >= 30 THEN RETURN 'limited'; END IF;
  INSERT INTO prompt_usage (id, feature, prompt, result, duration_ms, rate_key)
    VALUES (event_id, event_feature, event_prompt, event_result, event_duration_ms, event_rate_key);
  RETURN 'saved';
END;
$$;
REVOKE ALL ON FUNCTION public.record_prompt_usage(uuid,text,text,jsonb,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_prompt_usage(uuid,text,text,jsonb,integer,text) TO service_role;
