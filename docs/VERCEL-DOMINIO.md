# Dominio Vercel — ticketing-yocabe

## Obiettivo

URL: **https://ticketing-yocabe.vercel.app/**

## Passi (dashboard Vercel)

1. Apri il progetto **ticketing-app** su [vercel.com](https://vercel.com)
2. **Settings → Domains**
3. Aggiungi dominio: `ticketing-yocabe.vercel.app`
   - Se il nome è libero, Vercel lo assegna al progetto
   - Se occupato da altro progetto tuo, rimuovilo dall'altro o usa un alias
4. Imposta `ticketing-yocabe.vercel.app` come **primary** (opzionale)
5. **Settings → Environment Variables**
   ```
   NEXT_PUBLIC_APP_URL=https://ticketing-yocabe.vercel.app
   ```
6. **Deployments → Redeploy** (ultimo deploy)

## Aggiornare anche

| Dove | Cosa |
|------|------|
| Supabase Auth → Site URL | `https://ticketing-yocabe.vercel.app` |
| Supabase → Redirect URLs | vedi `SUPABASE-AUTH-SETUP.md` |
| Gmail Apps Script | `API_URL` e `BASE_URL` con nuovo dominio |
| `docs/gmail-custom-ingest.md` | esempi URL |
| `COCKPIT/AVVIO.md` | URL produzione |

Il vecchio `ticketing-app-ashen.vercel.app` può restare come alias finché non rimuovi il dominio.
