-- Esegui questo script su Supabase SQL Editor (una tantum).
-- Copia nome/azienda da auth.users → profiles e abilita sync lato server.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, full_name, company_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'first_name', ''),
    nullif(new.raw_user_meta_data->>'last_name', ''),
    nullif(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        trim(concat(
          coalesce(new.raw_user_meta_data->>'first_name', ''),
          ' ',
          coalesce(new.raw_user_meta_data->>'last_name', '')
        ))
      ),
      ''
    ),
    nullif(new.raw_user_meta_data->>'company_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'user')
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name = coalesce(excluded.last_name, public.profiles.last_name),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_name = coalesce(excluded.company_name, public.profiles.company_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_profile_from_auth()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select raw_user_meta_data into meta
  from auth.users
  where id = uid;

  update public.profiles
  set
    first_name = coalesce(nullif(meta->>'first_name', ''), first_name),
    last_name = coalesce(nullif(meta->>'last_name', ''), last_name),
    full_name = coalesce(
      nullif(meta->>'full_name', ''),
      nullif(
        trim(concat(
          coalesce(meta->>'first_name', ''),
          ' ',
          coalesce(meta->>'last_name', '')
        )),
        ''
      ),
      full_name
    ),
    company_name = coalesce(nullif(meta->>'company_name', ''), company_name)
  where id = uid;
end;
$$;

grant execute on function public.sync_profile_from_auth() to authenticated;

-- Ripristina profili incompleti già esistenti
update public.profiles p
set
  first_name = coalesce(nullif(u.raw_user_meta_data->>'first_name', ''), p.first_name),
  last_name = coalesce(nullif(u.raw_user_meta_data->>'last_name', ''), p.last_name),
  full_name = coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(
      trim(concat(
        coalesce(u.raw_user_meta_data->>'first_name', ''),
        ' ',
        coalesce(u.raw_user_meta_data->>'last_name', '')
      )),
      ''
    ),
    p.full_name
  ),
  company_name = coalesce(nullif(u.raw_user_meta_data->>'company_name', ''), p.company_name)
from auth.users u
where u.id = p.id
  and (
    p.first_name is null
    or p.last_name is null
    or p.full_name is null
    or p.company_name is null
  );
