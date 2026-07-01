-- Categorie e casistiche configurabili (Impostazioni team_leader)
-- Supabase → SQL Editor → incolla tutto → Run

create table if not exists public.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_case_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticket_categories_sort_idx
  on public.ticket_categories (sort_order, label);

create index if not exists ticket_case_types_sort_idx
  on public.ticket_case_types (sort_order, label);

-- Seed categorie (come nel codice attuale)
insert into public.ticket_categories (code, label, sort_order) values
  ('general', 'Generale', 10),
  ('it', 'IT', 20),
  ('hr', 'HR', 30),
  ('admin', 'Amministrazione', 40),
  ('bug', 'Bug', 50),
  ('orders', 'Ordini', 60),
  ('shipping', 'Spedizioni', 70),
  ('warehouse', 'Magazzino', 80),
  ('partner_fby', 'Partner FBY', 90)
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

-- Seed casistiche (come lib/ticket-classification.ts)
insert into public.ticket_case_types (code, label, sort_order) values
  ('pacco_non_ricevuto', 'Pacco non ricevuto', 10),
  ('pacco_non_consegnato_rimborso_emesso', 'Pacco non consegnato, rimborso emesso da Zalando', 20),
  ('consegna_senza_ordine', 'Consegna senza ordine', 30),
  ('warehouse_rejection', 'Ordine rifiutato da magazzino', 40),
  ('logistics_cancel', 'Annullamento logistico', 50)
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

alter table public.ticket_categories enable row level security;
alter table public.ticket_case_types enable row level security;

drop policy if exists "ticket_categories_select_active" on public.ticket_categories;
create policy "ticket_categories_select_active"
  on public.ticket_categories for select to authenticated
  using (is_active = true);

drop policy if exists "ticket_case_types_select_active" on public.ticket_case_types;
create policy "ticket_case_types_select_active"
  on public.ticket_case_types for select to authenticated
  using (is_active = true);

-- Verifica
select code, label, sort_order, is_active from public.ticket_categories order by sort_order;
select code, label, sort_order, is_active from public.ticket_case_types order by sort_order;
