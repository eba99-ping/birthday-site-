-- RLS decides which rows each visitor may access, but Postgres table grants
-- are still required before those policies can run through the Supabase API.
grant usage on schema public to anon, authenticated;

grant select on public.projects, public.site_settings to anon;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select, insert, update, delete on public.activation_codes to authenticated;
grant select, insert, update, delete on public.site_settings to authenticated;
