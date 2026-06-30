-- Allinea profiles con auth.users quando l'email coincide ma l'id no.
-- SQL Editor → Run

-- 1) Diagnostica
select
  u.id as auth_id,
  u.email,
  p.id as profile_id,
  p.first_name,
  p.last_name,
  p.company_name
from auth.users u
left join public.profiles p on p.email = u.email
where u.email = 'enrico.spalvieri@yocabe.com';

-- 2) Ripara (mantiene nome/azienda già presenti)
do $$
declare
  uid uuid;
  old_first text;
  old_last text;
  old_full text;
  old_company text;
  old_role text;
begin
  select id
  into uid
  from auth.users
  where email = 'enrico.spalvieri@yocabe.com';

  if uid is null then
    raise exception 'Utente auth non trovato per enrico.spalvieri@yocabe.com';
  end if;

  select first_name, last_name, full_name, company_name, role
  into old_first, old_last, old_full, old_company, old_role
  from public.profiles
  where email = 'enrico.spalvieri@yocabe.com'
  limit 1;

  delete from public.profiles
  where email = 'enrico.spalvieri@yocabe.com';

  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    full_name,
    company_name,
    role
  )
  values (
    uid,
    'enrico.spalvieri@yocabe.com',
    coalesce(old_first, 'Enrico'),
    coalesce(old_last, 'Spalvieri'),
    coalesce(old_full, 'Enrico Spalvieri'),
    coalesce(old_company, 'Yocabè'),
    coalesce(old_role, 'user')
  );
end $$;

-- 3) Verifica: auth_id = profile_id
select u.id, p.id, p.email, p.first_name, p.full_name, p.company_name
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'enrico.spalvieri@yocabe.com';
