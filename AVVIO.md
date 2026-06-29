# Ticketing — avvio e ambienti

**Cartella codice:** `C:\Users\enric\Documents\cursor\goal\goals\goal-02-ticketing`

## URL ufficiale

| Priorità | URL | Stato |
|----------|-----|--------|
| **Obiettivo** | https://ticketing-yocabe.app | Da acquistare/collegare — vedi guida sotto |
| **Intermedio** | https://ticketing-yocabe.vercel.app | DNS ok — collegare al progetto Vercel |
| Legacy | https://ticketing-app-ashen.vercel.app | Funziona oggi — da sostituire |

**Guida passo-passo (solo click, zero codice):** `docs/DOMINIO-SETUP-ENRICO.md`

---

## Variabile Vercel (obbligatoria)

```
NEXT_PUBLIC_APP_URL=https://ticketing-yocabe.app
```

(fino a quando il `.app` non è attivo, usa `https://ticketing-yocabe.vercel.app`)

Dopo ogni modifica → **Redeploy** su Vercel.

---

## Supabase Auth

Site URL e Redirect URLs devono usare **lo stesso URL** di `NEXT_PUBLIC_APP_URL`.  
Dettaglio: `docs/SUPABASE-AUTH-SETUP.md`

---

## Sviluppo locale (opzionale)

```powershell
cd "C:\Users\enric\Documents\cursor\goal\goals\goal-02-ticketing"
npm run dev
```

→ http://localhost:3000 — solo per test sviluppo, non per il team.

---

## Riferimenti

- `docs/DOMINIO-SETUP-ENRICO.md` — **inizia da qui**
- `docs/gmail-custom-ingest.md` — Apps Script Gmail
- `COCKPIT/goal-02-roadmap-q3.md` — pilota FBY
