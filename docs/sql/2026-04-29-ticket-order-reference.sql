alter table public.tickets
  add column if not exists order_reference text;

create index if not exists tickets_order_reference_idx on public.tickets(order_reference);
