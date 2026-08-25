-- The Phone Face CRM - revoke anonymous access to permission helper RPCs
begin;

revoke all on function public.current_user_can(text) from public, anon;
revoke all on function public.current_user_has_permission(text) from public, anon;
revoke all on function public.current_user_is_admin() from public, anon;
revoke all on function public.current_user_permissions() from public, anon;

grant execute on function public.current_user_can(text) to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_permissions() to authenticated;

commit;
