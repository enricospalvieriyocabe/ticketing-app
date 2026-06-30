-- Fix RLS profiles: evita ricorsione infinita su profiles_select_staff.
-- SQL Editor → incolla TUTTO → Run

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

-- Verifica policy attive
select policyname, cmd, qual
from pg_policies
where tablename = 'profiles'
order by policyname;
