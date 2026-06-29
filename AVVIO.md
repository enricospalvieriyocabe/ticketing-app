# Ticketing — avvio e ambienti

**Cartella codice:** `C:\Users\enric\Documents\cursor\goal\goals\goal-02-ticketing`

## Ambiente principale (produzione)

**URL:** https://ticketing-app-ashen.vercel.app/

Usa sempre questo per:
- lavoro operativo con il team (Giulia, CS, OPS)
- pilota FBY Binda / Jadea
- ingest Gmail (Apps Script)
- demo e team meeting

**Backend:** Supabase progetto `ticketing-app` (riesumato 2026-06)

### Checklist produzione

| # | Controllo | Dove |
|---|-----------|------|
| 1 | App risponde | apri URL Vercel → login OK |
| 2 | Env Vercel = Supabase attivo | Vercel → Project → **Settings → Environment Variables** |
| 3 | Ingest Gmail | Apps Script `API_URL` = `https://ticketing-app-ashen.vercel.app/api/email-ingest` |
| 4 | Reply outbound | Apps Script `BASE_URL` = `https://ticketing-app-ashen.vercel.app` |

Variabili richieste su **Vercel** (stesse di `.env.local` locale):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
EMAIL_INGEST_TOKEN
EMAIL_INGEST_SYSTEM_USER_ID
EMAIL_INGEST_DEFAULT_CATEGORY
EMAIL_INGEST_DEFAULT_PRIORITY
EMAIL_INGEST_IGNORE_FROM   (opzionale)
```

Dopo modifica env su Vercel: **Redeploy** (Deployments → ⋯ → Redeploy).

### Deploy nuovo codice

Le modifiche al codice in locale **non** compaiono su Vercel finché non fai deploy:

- push su branch collegato a Vercel, oppure
- `npx vercel --prod` dalla cartella progetto (se CLI configurata)

---

## Ambiente locale (solo sviluppo)

```powershell
cd "C:\Users\enric\Documents\cursor\goal\goals\goal-02-ticketing"
npm run dev
```

→ http://localhost:3000 — utile per test rapidi prima del deploy, **non** per Gmail ingest.

---

## Supabase — pausa automatica (piano Free)

I progetti Free si **pausano dopo ~7 giorni senza traffico** sul database.

- **Prevenzione:** uso quotidiano via Vercel + pilota clienti, oppure upgrade Pro, oppure ping settimanale
- Docs: https://supabase.com/docs/guides/platform/free-project-pausing

---

## Riferimenti

- `docs/gmail-custom-ingest.md` — Apps Script inbound/outbound
- `docs/ticketing-system-summary.md` — funzionalità implementate
- `COCKPIT/goal-02-roadmap-q3.md` — pilota FBY, BigQuery, ordini rifiutati WH
