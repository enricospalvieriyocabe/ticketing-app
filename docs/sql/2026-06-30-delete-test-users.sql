-- Elimina account di test includendo ticket e dati collegati.
-- Esegui su Supabase → SQL Editor → Run

begin;

create temporary table tmp_delete_users on commit drop as
select id, email
from auth.users
where email in (
  'enricospalvieri@gmail.com',
  'e0.spalvieri@gmail.com'
);

create temporary table tmp_delete_tickets on commit drop as
select id
from public.tickets
where created_by in (select id from tmp_delete_users)
   or requester_id in (select id from tmp_delete_users)
   or assigned_to in (select id from tmp_delete_users);

delete from public.ticket_comments
where ticket_id in (select id from tmp_delete_tickets)
   or user_id in (select id from tmp_delete_users);

delete from public.ticket_events
where ticket_id in (select id from tmp_delete_tickets)
   or user_id in (select id from tmp_delete_users);

delete from public.notifications
where user_id in (select id from tmp_delete_users);

delete from public.ticket_email_replies
where ticket_id in (select id from tmp_delete_tickets)
   or requested_by in (select id from tmp_delete_users);

delete from public.tickets
where id in (select id from tmp_delete_tickets);

delete from public.profiles
where id in (select id from tmp_delete_users);

delete from auth.users
where id in (select id from tmp_delete_users);

commit;

-- Verifica finale (deve restituire 0 righe)
select 'profiles' as tabella, email
from public.profiles
where email in ('enricospalvieri@gmail.com', 'e0.spalvieri@gmail.com')
union all
select 'auth.users' as tabella, email
from auth.users
where email in ('enricospalvieri@gmail.com', 'e0.spalvieri@gmail.com');
