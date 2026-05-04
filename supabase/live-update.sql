create extension if not exists pgcrypto with schema extensions;

alter table public.oro_settings
  alter column is_open set default false,
  alter column max_submissions set default 0;

alter table public.oro_settings
  drop constraint if exists oro_settings_max_submissions_check;

alter table public.oro_settings
  add constraint oro_settings_max_submissions_check check (max_submissions >= 0);

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

  delete from public.oro_submissions;

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

grant execute on function public.set_oro_settings(text, text, boolean, integer)
  to anon, authenticated;
grant execute on function public.reset_oro_portal(text) to anon, authenticated;
