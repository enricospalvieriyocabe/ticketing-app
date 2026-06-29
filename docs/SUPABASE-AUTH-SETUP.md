# Supabase Auth — conferma email e redirect

## Problema risolto nel codice

La registrazione ora passa `emailRedirectTo` verso **`/auth/callback`** sull'URL di produzione, non più localhost implicito.

Variabile richiesta su **Vercel** e in `.env.local`:

```
NEXT_PUBLIC_APP_URL=https://ticketing-yocabe.vercel.app
```

(o `https://ticketing-app-ashen.vercel.app` finché non rinomini il dominio)

Dopo ogni modifica env → **Redeploy** su Vercel.

---

## Configurazione obbligatoria su Supabase Dashboard

**Authentication → URL Configuration**

| Campo | Valore |
|-------|--------|
| **Site URL** | `https://ticketing-yocabe.vercel.app` (URL principale) |
| **Redirect URLs** | Aggiungi tutti quelli che usi: |

```
https://ticketing-yocabe.vercel.app/**
https://ticketing-yocabe.vercel.app/auth/callback
https://ticketing-app-ashen.vercel.app/**
https://ticketing-app-ashen.vercel.app/auth/callback
http://localhost:3000/**
http://localhost:3000/auth/callback
```

Salva. Senza questi URL Supabase rifiuta il redirect dopo il click nella mail.

---

## Email di conferma — template (opzionale)

**Authentication → Email Templates → Confirm signup**

Sostituisci il corpo con HTML brandizzato (logo ospitato su Vercel):

```html
<h2>Benvenuto su Yocabè Operations</h2>
<p>Conferma la tua email per accedere al sistema ticketing.</p>
<p><a href="{{ .ConfirmationURL }}">Conferma email</a></p>
<p>Se non ti sei registrato, ignora questo messaggio.</p>
```

`{{ .ConfirmationURL }}` è gestito da Supabase e punterà a `/auth/callback` grazie a `emailRedirectTo` nel codice.

Per logo nell'email, usa URL assoluto dopo deploy:

```html
<img src="https://ticketing-yocabe.vercel.app/logo-yocabe.png" alt="Yocabè" width="160" />
```

---

## Test registrazione

1. Apri l'app in **incognito**
2. Registrazione con email reale
3. Clicca link nella mail
4. Deve atterrare su `https://…/auth/callback?...` e poi sulla home **loggato**
5. Se errore: controlla Redirect URLs su Supabase e `NEXT_PUBLIC_APP_URL` su Vercel
