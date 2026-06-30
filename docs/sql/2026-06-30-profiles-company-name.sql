-- Aggiunge il campo azienda ai profili utenti (registrazione clienti)
alter table public.profiles
  add column if not exists company_name text;

create index if not exists profiles_company_name_idx
  on public.profiles(company_name);
