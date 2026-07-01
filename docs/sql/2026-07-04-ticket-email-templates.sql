-- Template email: scopo (compose, ticket_open, ticket_close, user_reply, off_hours)
-- Supabase → SQL Editor → Run

alter table public.ticket_auto_reply_templates
  add column if not exists purpose text not null default 'compose';

comment on column public.ticket_auto_reply_templates.purpose is
  'compose/off_hours = risposta operatore; ticket_open = conferma apertura; ticket_close = chiusura; user_reply = notifica risposta staff';

create index if not exists ticket_auto_reply_templates_purpose_idx
  on public.ticket_auto_reply_templates (purpose, is_enabled);

-- Placeholder variabili nei template:
-- {{ticket_number}} {{title}} {{reply_body}} {{app_url}} {{ticket_url}}
