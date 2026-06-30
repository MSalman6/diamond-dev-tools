-- Grants for the least-privilege Express API role (diamond_api). Runs after the api_keys table
-- exists (migration 003). The role itself is created at DB init (container-content/05_app_role.sh);
-- the guard makes this a no-op in environments where that role has not been created.
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
