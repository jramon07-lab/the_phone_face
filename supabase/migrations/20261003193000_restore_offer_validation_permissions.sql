-- The invoker validator delegates null and legacy preferences to this pure helper.
-- Restore the authenticated caller's EXECUTE permission without granting anonymous
-- access, table access, or elevated execution privileges.
revoke all on function crm_private.router_return_preferences_before_installations(jsonb) from public, anon;
grant execute on function crm_private.router_return_preferences_before_installations(jsonb) to authenticated;
