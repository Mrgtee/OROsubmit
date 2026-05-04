create extension if not exists pgcrypto with schema extensions;

drop function if exists public.submit_campaign_link(text, text);
drop view if exists public.campaigns_with_stats;
drop table if exists public.submissions cascade;
drop table if exists public.campaigns cascade;

create table if not exists public.oro_settings (
  id boolean primary key default true check (id),
  title text not null default 'Submit YouTube links',
  is_open boolean not null default false,
  max_submissions integer not null default 0 check (max_submissions >= 0),
  admin_password_hash text not null default extensions.crypt('oro', extensions.gen_salt('bf')),
  updated_at timestamptz not null default now()
);

alter table public.oro_settings
  alter column is_open set default false,
  alter column max_submissions set default 0;

alter table public.oro_settings
  drop constraint if exists oro_settings_max_submissions_check;

alter table public.oro_settings
  add constraint oro_settings_max_submissions_check check (max_submissions >= 0);

insert into public.oro_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.oro_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  discord_name text not null,
  discord_name_key text generated always as (lower(btrim(discord_name))) stored,
  link text not null check (link ~* '^https?://'),
  position integer not null check (position > 0),
  submitted_at timestamptz not null default now(),
  unique (discord_name_key),
  unique (position)
);

create index if not exists oro_submissions_position_idx
  on public.oro_submissions (position);

alter table public.oro_settings enable row level security;
alter table public.oro_submissions enable row level security;

drop policy if exists "No direct settings access" on public.oro_settings;
drop policy if exists "No direct submissions access" on public.oro_submissions;

create policy "No direct settings access"
  on public.oro_settings
  for all
  using (false)
  with check (false);

create policy "No direct submissions access"
  on public.oro_submissions
  for all
  using (false)
  with check (false);

drop view if exists public.oro_portal_state;

create view public.oro_portal_state as
select
  s.title,
  case
    when s.is_open and count(os.id) < s.max_submissions then true
    else false
  end as is_open,
  s.max_submissions,
  count(os.id)::integer as submission_count
from public.oro_settings s
left join public.oro_submissions os on true
where s.id = true
group by s.id;

create or replace function public.verify_admin_password(input_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.oro_settings
    where id = true
      and admin_password_hash = extensions.crypt(input_password, admin_password_hash)
  );
$$;

create or replace function public.submit_oro_link(
  input_discord_name text,
  input_link text
)
returns table (
  status text,
  submission_count integer,
  max_submissions integer,
  is_open boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.oro_settings%rowtype;
  current_count integer;
  next_position integer;
  clean_discord text;
begin
  clean_discord := btrim(input_discord_name);

  select *
  into settings_row
  from public.oro_settings
  where id = true
  for update;

  select count(*)
  into current_count
  from public.oro_submissions;

  if clean_discord = '' then
    raise exception 'Discord name is required.';
  end if;

  if exists (
    select 1
    from public.oro_submissions
    where discord_name_key = lower(clean_discord)
  ) then
    return query
    select
      'duplicate',
      current_count,
      settings_row.max_submissions,
      settings_row.is_open and current_count < settings_row.max_submissions;
    return;
  end if;

  if settings_row.is_open is false or current_count >= settings_row.max_submissions then
    update public.oro_settings
    set is_open = false,
        updated_at = now()
    where id = true;

    return query
    select 'closed', current_count, settings_row.max_submissions, false;
    return;
  end if;

  next_position := current_count + 1;

  insert into public.oro_submissions (discord_name, link, position)
  values (clean_discord, input_link, next_position);

  if next_position >= settings_row.max_submissions then
    update public.oro_settings
    set is_open = false,
        updated_at = now()
    where id = true;
  end if;

  return query
  select
    'accepted',
    next_position,
    settings_row.max_submissions,
    next_position < settings_row.max_submissions;
end;
$$;

create or replace function public.list_admin_submissions(input_password text)
returns table (
  id uuid,
  discord_name text,
  link text,
  submission_position integer,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_admin_password(input_password) then
    raise exception 'Wrong password.';
  end if;

  return query
  select
    os.id,
    os.discord_name,
    os.link,
    os.position as submission_position,
    os.submitted_at
  from public.oro_submissions os
  order by os.position asc;
end;
$$;

create or replace function public.set_oro_settings(
  input_password text,
  input_title text,
  input_is_open boolean,
  input_max_submissions integer
)
returns table (
  title text,
  is_open boolean,
  max_submissions integer,
  submission_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  next_max integer;
begin
  if not public.verify_admin_password(input_password) then
    raise exception 'Wrong password.';
  end if;

  next_max := greatest(coalesce(input_max_submissions, 0), 0);

  select count(*)
  into current_count
  from public.oro_submissions;

  update public.oro_settings
  set title = coalesce(nullif(btrim(input_title), ''), 'Submit YouTube links'),
      max_submissions = next_max,
      is_open = input_is_open and current_count < next_max,
      updated_at = now()
  where id = true;

  return query
  select
    s.title,
    s.is_open,
    s.max_submissions,
    current_count
  from public.oro_settings s
  where s.id = true;
end;
$$;

create or replace function public.reset_oro_portal(input_password text)
returns table (
  title text,
  is_open boolean,
  max_submissions integer,
  submission_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_admin_password(input_password) then
    raise exception 'Wrong password.';
  end if;

  delete from public.oro_submissions
  where true;

  update public.oro_settings
  set title = 'Submit YouTube links',
      is_open = false,
      max_submissions = 0,
      updated_at = now()
  where id = true;

  return query
  select
    s.title,
    s.is_open,
    s.max_submissions,
    0::integer
  from public.oro_settings s
  where s.id = true;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.oro_portal_state to anon, authenticated;
grant execute on function public.verify_admin_password(text) to anon, authenticated;
grant execute on function public.submit_oro_link(text, text) to anon, authenticated;
grant execute on function public.list_admin_submissions(text) to anon, authenticated;
grant execute on function public.set_oro_settings(text, text, boolean, integer)
  to anon, authenticated;
grant execute on function public.reset_oro_portal(text) to anon, authenticated;
