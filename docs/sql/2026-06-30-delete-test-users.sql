-- Elimina account di test (profiles + auth.users)
-- Esegui su Supabase → SQL Editor → Run

delete from public.profiles
where email in (
  'enricospalvieri@gmail.com',
  'e0.spalvieri@gmail.com'
);

delete from auth.users
where email in (
  'enricospalvieri@gmail.com',
  'e0.spalvieri@gmail.com'
);

-- Verifica che non restino righe
select email from public.profiles
where email in ('enricospalvieri@gmail.com', 'e0.spalvieri@gmail.com');

select email from auth.users
where email in ('enricospalvieri@gmail.com', 'e0.spalvieri@gmail.com');
