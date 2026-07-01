-- Utente tecnico ticket@yocabe.com (ruolo system, solo ingest email)
-- Esegui DOPO aver creato l'utente in Supabase Auth (vedi sotto).

-- 1) Supabase Dashboard → Authentication → Users → Add user
--    Email: ticket@yocabe.com
--    Password: genera una password casuale (non serve login)
--    Spunta "Auto Confirm User"
--    User metadata (opzionale):
--      { "role": "system", "full_name": "Ticket System" }
--
-- 2) Il trigger handle_new_user crea il profilo in public.profiles.
--    Poi esegui questo SQL per impostare il ruolo system:

update public.profiles
set
  role = 'system',
  full_name = coalesce(full_name, 'Ticket System'),
  company_name = coalesce(company_name, 'Yocabè')
where lower(email) = lower('ticket@yocabe.com');

-- 3) Copia l'UUID dell'utente e aggiorna le variabili ambiente:
--    EMAIL_INGEST_SYSTEM_USER_ID=<uuid-da-dashboard>
--    Locale: .env.local
--    Produzione: Vercel → Project Settings → Environment Variables
--
-- Verifica:
select id, email, role, full_name, company_name
from public.profiles
where lower(email) = lower('ticket@yocabe.com');
