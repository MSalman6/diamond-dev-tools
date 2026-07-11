-- Grants for the diamond_api role (created at DB init). Runs after api_keys exists (003).
-- No-op if the role is absent.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'diamond_api') THEN
    -- Read access to all current tables/sequences (default privileges cover future ones).
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO diamond_api;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO diamond_api;
    -- The API manages API keys (auth reads + last_used_at writes; keygen CLI create/enable/delete).
    GRANT INSERT, UPDATE, DELETE ON api_keys TO diamond_api;
  END IF;
END
$$;
