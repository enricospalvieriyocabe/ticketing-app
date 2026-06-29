# Supabase Auth — conferma email e redirect

**URL da usare ovunque (quando attivo):** `https://ticketing-yocabe.app`  
**Fino ad allora:** `https://ticketing-yocabe.vercel.app`

Guida completa domini: `DOMINIO-SETUP-ENRICO.md`

---

## Variabile Vercel

```
NEXT_PUBLIC_APP_URL=https://ticketing-yocabe.app
```

(o `.vercel.app` finché il dominio `.app` non è pronto)

---

## Supabase Dashboard

**Authentication → URL Configuration**

| Campo | Valore |
|-------|--------|
| **Site URL** | `https://ticketing-yocabe.app` |
| **Redirect URLs** | `https://ticketing-yocabe.app/**` |
| | `https://ticketing-yocabe.app/auth/callback` |
| | `https://ticketing-yocabe.vercel.app/**` |
| | `https://ticketing-yocabe.vercel.app/auth/callback` |
| | `https://ticketing-app-ashen.vercel.app/**` (legacy, temporaneo) |

**Save**

---

## Email conferma registrazione (opzionale)

**Authentication → Email Templates → Confirm signup**

Logo (dopo deploy):

```html
<img src="https://ticketing-yocabe.app/logo-yocabe.png" alt="Yocabè" width="160" />
<p><a href="{{ .ConfirmationURL }}">Conferma email</a></p>
```
