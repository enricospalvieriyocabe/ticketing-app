-- Riorganizzazione pagina ticket: numero ticket, note staff, ruolo system
-- Supabase → SQL Editor → Run

-- 1) Numero ticket leggibile (#1001, #1002, ...)
create sequence if not exists public.tickets_ticket_number_seq;

alter table public.tickets
  add column if not exists ticket_number bigint unique;

select setval(
  'public.tickets_ticket_number_seq',
  coalesce((select max(ticket_number) from public.tickets), 0) + 1,
  false
);

update public.tickets
set ticket_number = nextval('public.tickets_ticket_number_seq')
where ticket_number is null;

alter table public.tickets
  alter column ticket_number set default nextval('public.tickets_ticket_number_seq');

create index if not exists tickets_ticket_number_idx on public.tickets (ticket_number);

-- 2) Note interne (solo operator / team_leader via RLS)
create table if not exists public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticket_notes_ticket_idx
  on public.ticket_notes (ticket_id, created_at);

alter table public.ticket_notes enable row level security;

drop policy if exists "ticket_notes_staff_select" on public.ticket_notes;
create policy "ticket_notes_staff_select"
  on public.ticket_notes for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('operator', 'team_leader')
    )
  );

drop policy if exists "ticket_notes_staff_insert" on public.ticket_notes;
create policy "ticket_notes_staff_insert"
  on public.ticket_notes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('operator', 'team_leader')
    )
  );

drop policy if exists "ticket_notes_staff_update" on public.ticket_notes;
create policy "ticket_notes_staff_update"
  on public.ticket_notes for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('operator', 'team_leader')
    )
  );

-- 3) Profilo system per ingest (aggiorna EMAIL_INGEST_SYSTEM_USER_ID nel .env)
-- Vedi anche: docs/sql/2026-07-03-create-system-user-ticket.sql
-- Esempio: update public.profiles set role = 'system' where email = 'ticket@yocabe.com';

-- Verifica
select ticket_number, title, created_at from public.tickets order by ticket_number desc limit 10;
