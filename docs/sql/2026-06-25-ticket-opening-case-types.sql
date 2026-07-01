-- Casistiche per apertura manuale ticket + campi opzionali su tickets
-- Supabase → SQL Editor → incolla tutto → Run

alter table public.ticket_case_types
  add column if not exists show_in_open_form boolean not null default false,
  add column if not exists requires_order_reference boolean not null default false,
  add column if not exists requires_shipping_info boolean not null default false,
  add column if not exists requires_delivery_info boolean not null default false,
  add column if not exists requires_documents_note boolean not null default false;

alter table public.tickets
  add column if not exists shipping_info text,
  add column if not exists delivery_info text,
  add column if not exists documents_note text;

-- Casistiche apertura manuale (distinte da classificazione email)
insert into public.ticket_case_types (
  code,
  label,
  sort_order,
  show_in_open_form,
  requires_order_reference,
  requires_shipping_info,
  requires_delivery_info,
  requires_documents_note
) values
  (
    'ticket_su_ordine',
    'Ticket su ordine',
    5,
    true,
    true,
    false,
    false,
    false
  ),
  (
    'ticket_generale',
    'Ticket generale',
    6,
    true,
    false,
    false,
    false,
    false
  ),
  (
    'ticket_rifornimento_magazzino',
    'Ticket rifornimento magazzino',
    7,
    true,
    false,
    true,
    true,
    true
  )
on conflict (code) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  show_in_open_form = excluded.show_in_open_form,
  requires_order_reference = excluded.requires_order_reference,
  requires_shipping_info = excluded.requires_shipping_info,
  requires_delivery_info = excluded.requires_delivery_info,
  requires_documents_note = excluded.requires_documents_note;

-- Le casistiche email restano solo per ingest/classificazione
update public.ticket_case_types
set show_in_open_form = false
where code in (
  'pacco_non_ricevuto',
  'pacco_non_consegnato_rimborso_emesso',
  'consegna_senza_ordine',
  'warehouse_rejection',
  'logistics_cancel'
);

-- Verifica
select
  code,
  label,
  show_in_open_form,
  requires_order_reference,
  requires_shipping_info,
  requires_delivery_info,
  requires_documents_note
from public.ticket_case_types
order by sort_order, label;
