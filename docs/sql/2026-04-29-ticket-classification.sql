alter table public.tickets
  add column if not exists case_type text,
  add column if not exists case_tags text[] not null default '{}',
  add column if not exists source_channel text;

create index if not exists tickets_case_type_idx on public.tickets(case_type);
