create table if not exists public.ticket_email_replies (
  id bigserial primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  thread_id text,
  status text not null default 'pending',
  external_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ticket_email_replies_status_idx
  on public.ticket_email_replies(status, created_at);
