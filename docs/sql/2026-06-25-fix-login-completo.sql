-- FIX LOGIN COMPLETO — esegui tutto in Supabase → SQL Editor → Run
-- Risolve: ricorsione RLS su profiles + allinea id profilo con auth.users

-- ── 1) RLS profiles senza ricorsione ──────────────────────────────────────

drop policy if exists "profiles_select_staff" on public.profiles;

create or replace function public.is_staff_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('operator', 'team_leader')
  );
$$;

revoke all on function public.is_staff_user() from public;
grant execute on function public.is_staff_user() to authenticated;

create policy "profiles_select_staff"
  on public.profiles
  for select
  to authenticated
  using (public.is_staff_user());

-- ── 2) Diagnostica id auth vs profiles ─────────────────────────────────────

select
  u.id as auth_id,
  u.email,
  p.id as profile_id,
  p.first_name,
  p.last_name,
  p.company_name,
  p.role
from auth.users u
left join public.profiles p on lower(p.email) = lower(u.email)
where u.email in ('enrico.spalvieri@yocabe.com', 'giulia.borri@yocabe.com')
order by u.email;

-- ── 3) Ripara profili con id sbagliato (mantiene nome/azienda) ─────────────

do $$
declare
  rec record;
  uid uuid;
  old_first text;
  old_last text;
  old_full text;
  old_company text;
  old_role text;
  old_id uuid;
begin
  for rec in
    select unnest(array['enrico.spalvieri@yocabe.com', 'giulia.borri@yocabe.com']) as email
  loop
    select id into uid from auth.users where lower(email) = lower(rec.email);
    if uid is null then
      raise notice 'Utente auth non trovato: %', rec.email;
      continue;
    end if;

    select id, first_name, last_name, full_name, company_name, role
    into old_id, old_first, old_last, old_full, old_company, old_role
    from public.profiles
    where lower(email) = lower(rec.email)
    limit 1;

    if old_id is not null and old_id = uid then
      raise notice 'Profilo già allineato: %', rec.email;
      continue;
    end if;

    if old_id is not null and old_id <> uid then
      update public.tickets set requester_id = uid where requester_id = old_id;
      update public.tickets set created_by = uid where created_by = old_id;
      update public.tickets set assigned_to = uid where assigned_to = old_id;
      update public.notifications set user_id = uid where user_id = old_id;
      update public.ticket_events set user_id = uid where user_id = old_id;
      delete from public.profiles where id = old_id;
    end if;

    insert into public.profiles (id, email, first_name, last_name, full_name, company_name, role)
    values (
      uid,
      lower(rec.email),
      old_first,
      old_last,
      coalesce(old_full, trim(coalesce(old_first, '') || ' ' || coalesce(old_last, ''))),
      old_company,
      coalesce(old_role, 'user')
    )
    on conflict (id) do update set
      email = excluded.email,
      first_name = coalesce(excluded.first_name, public.profiles.first_name),
      last_name = coalesce(excluded.last_name, public.profiles.last_name),
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      company_name = coalesce(excluded.company_name, public.profiles.company_name),
      role = coalesce(excluded.role, public.profiles.role);

    raise notice 'Profilo riparato: %', rec.email;
  end loop;
end $$;

-- ── 4) Verifica finale ─────────────────────────────────────────────────────

select
  u.id as auth_id,
  p.id as profile_id,
  u.email,
  p.first_name,
  p.full_name,
  p.company_name,
  p.role,
  case when u.id = p.id then 'OK' else 'MISMATCH' end as stato
from auth.users u
join public.profiles p on p.id = u.id
where u.email in ('enrico.spalvieri@yocabe.com', 'giulia.borri@yocabe.com')
order by u.email;

select policyname, cmd
from pg_policies
where tablename = 'profiles'
order by policyname;
