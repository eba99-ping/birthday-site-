create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  share_slug text not null unique default encode(gen_random_bytes(9), 'hex'),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activation_codes (
  code text primary key,
  plan text not null check (plan in ('Normal','Premium','Advanced')),
  used boolean not null default false,
  project_id text references public.projects(id) on delete set null,
  payment_id text references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.email,''))
  on conflict (id) do update set name = excluded.name, email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.payments enable row level security;
alter table public.activation_codes enable row level security;
alter table public.site_settings enable row level security;

create policy "profiles own read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admins update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "published projects are public" on public.projects for select using (status = 'published' or owner_id = auth.uid() or public.is_admin());
create policy "users create projects" on public.projects for insert with check (owner_id = auth.uid());
create policy "owners update projects" on public.projects for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "owners delete projects" on public.projects for delete using (owner_id = auth.uid() or public.is_admin());
create policy "owners read payments" on public.payments for select using (owner_id = auth.uid() or public.is_admin());
create policy "users create payments" on public.payments for insert with check (owner_id = auth.uid());
create policy "admins update payments" on public.payments for update using (public.is_admin()) with check (public.is_admin());
create policy "admins manage codes" on public.activation_codes for all using (public.is_admin()) with check (public.is_admin());
create policy "admins inspect codes" on public.activation_codes for select to authenticated using (public.is_admin());
create policy "settings public read" on public.site_settings for select using (true);
create policy "admins manage settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gift-media', 'gift-media', true, 52428800, array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "gift media public read" on storage.objects for select using (bucket_id = 'gift-media');
create policy "users upload own media" on storage.objects for insert to authenticated with check (bucket_id = 'gift-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own media" on storage.objects for update to authenticated using (bucket_id = 'gift-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own media" on storage.objects for delete to authenticated using (bucket_id = 'gift-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create or replace function public.claim_payment_code(p_code text, p_project_id text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare target_payment public.payments;
begin
  select * into target_payment from public.payments
  where owner_id = auth.uid() and status = 'paid' and data->>'activationCode' = p_code
  for update;
  if not found then return false; end if;
  if coalesce(target_payment.data->>'projectId','') not in ('', p_project_id) then return false; end if;
  update public.payments set data = jsonb_set(data, '{projectId}', to_jsonb(p_project_id)), updated_at = now() where id = target_payment.id;
  update public.activation_codes set used = true, project_id = p_project_id, used_at = now() where code = p_code and (project_id is null or project_id = p_project_id);
  return true;
end;
$$;
grant execute on function public.claim_payment_code(text,text) to authenticated;
