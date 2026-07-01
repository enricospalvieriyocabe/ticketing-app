-- Template form di apertura ticket per categoria (sostituisce casistiche in apertura manuale)
-- Supabase → SQL Editor → incolla tutto → Run

alter table public.ticket_categories
  add column if not exists form_template text not null default 'ticket_generale';

-- Campi extra sui ticket (se non già presenti da script precedente)
alter table public.tickets
  add column if not exists shipping_info text,
  add column if not exists delivery_info text,
  add column if not exists documents_note text;

-- Template predefiniti per categoria
update public.ticket_categories
set form_template = 'ticket_generale'
where form_template is null or form_template = '';

update public.ticket_categories
set form_template = 'ticket_su_ordine'
where code in ('orders', 'ordini');

insert into public.ticket_categories (code, label, sort_order, form_template) values
  ('rifornimenti_magazzino', 'Rifornimenti Magazzino', 85, 'ticket_rifornimento_magazzino')
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  form_template = excluded.form_template;

update public.ticket_categories
set form_template = 'ticket_rifornimento_magazzino'
where code in ('rifornimenti_magazzino', 'warehouse', 'magazzino');

-- Rimuovi casistiche «apertura» create per errore (non sono classificazioni ticket)
delete from public.ticket_case_types
where code in (
  'ticket_su_ordine',
  'ticket_generale',
  'ticket_rifornimento_magazzino'
);

-- Verifica
select code, label, form_template, is_active
from public.ticket_categories
order by sort_order, label;
