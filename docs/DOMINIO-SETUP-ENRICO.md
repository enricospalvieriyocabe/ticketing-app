# URL ufficiale ticketing — guida per Enrico

**Obiettivo finale:** https://ticketing-yocabe.app  
**Passo intermedio (subito):** https://ticketing-yocabe.vercel.app

---

## Perché non l’abbiamo fatto subito?

1. Il progetto era già live su `ticketing-app-ashen.vercel.app` (nome auto-generato da Vercel al primo deploy).
2. `ticketing-yocabe.app` **non esiste ancora** come dominio acquistato — va registrato (costo ~15–20 €/anno).
3. `ticketing-yocabe.vercel.app` ha già il DNS attivo ma oggi dà **404** perché va **collegato al progetto giusto** su Vercel.

---

# PARTE A — Subito oggi (gratis): ticketing-yocabe.vercel.app

### A1. Collega il dominio al progetto

1. Vai su **https://vercel.com** e accedi
2. Apri il progetto **ticketing-app**
3. Clicca **Settings** → **Domains**
4. Nella casella “Add domain” scrivi:
   ```
   ticketing-yocabe.vercel.app
   ```
5. Clicca **Add**
6. Se chiede quale progetto, scegli **ticketing-app**
7. Attendi che lo stato diventi **Valid** (spunta verde)

### A2. Variabile ambiente (importante)

1. Sempre nel progetto → **Settings** → **Environment Variables**
2. Cerca `NEXT_PUBLIC_APP_URL`
   - Se **c’è**: clicca **Edit** e cambia il valore in:
     ```
     https://ticketing-yocabe.vercel.app
     ```
   - Se **non c’è**: **Add New** → nome `NEXT_PUBLIC_APP_URL`, valore come sopra, spunta Production + Preview + Development → **Save**
3. **Deployments** → tre puntini sul deploy in cima → **Redeploy**

### A3. Supabase (link email registrazione)

1. **https://supabase.com** → progetto **ticketing-app**
2. **Authentication** → **URL Configuration**
3. **Site URL** → incolla:
   ```
   https://ticketing-yocabe.vercel.app
   ```
4. **Redirect URLs** — aggiungi (se mancano):
   ```
   https://ticketing-yocabe.vercel.app/**
   https://ticketing-yocabe.vercel.app/auth/callback
   ```
5. **Save**

### A4. Verifica

Apri in incognito: **https://ticketing-yocabe.vercel.app**  
Deve mostrare la schermata Yocabè (non 404).

---

# PARTE B — Dominio professionale: ticketing-yocabe.app

Serve **acquistare** il dominio. Puoi farlo da Vercel (più semplice) o da un altro registrar.

### B1. Acquista il dominio su Vercel (consigliato)

1. Vercel → menu in alto **Domains** (non dentro il progetto, sezione account)
2. Cerca: `ticketing-yocabe.app`
3. Se **disponibile** → **Purchase** / **Buy** e completa il pagamento
4. Poi vai nel progetto **ticketing-app** → **Settings** → **Domains**
5. **Add domain** → scrivi:
   ```
   ticketing-yocabe.app
   ```
6. Vercel collega automaticamente DNS se il dominio è su Vercel

### B2. Se il dominio è su altro provider (es. Aruba, GoDaddy)

1. Aggiungi `ticketing-yocabe.app` al progetto Vercel (Domains → Add)
2. Vercel ti mostra un record **A** con IP tipo `76.76.21.21` — copialo
3. Nel pannello del registrar, crea record **A**:
   - Host: `@` (o vuoto)
   - Valore: l’IP che ti ha dato Vercel
4. Attendi 15 min – 24 ore (propagazione DNS)
5. Su Vercel lo stato diventa **Valid**

### B3. Dopo che ticketing-yocabe.app funziona

Ripeti **A2** e **A3** sostituendo l’URL con:
```
https://ticketing-yocabe.app
```

Opzionale: su Vercel imposta `ticketing-yocabe.app` come **Primary domain** (Domains → ⋯ → Set as Primary).

### B4. Gmail Apps Script (quando usi ingest email)

Apri lo script Gmail e aggiorna:
```javascript
const API_URL = "https://ticketing-yocabe.app/api/email-ingest";
const BASE_URL = "https://ticketing-yocabe.app";
```
(oppure `.vercel.app` finché non hai il .app)

---

## Cosa fa l’AI (già fatto / in corso)

- Codice e documentazione allineati a `https://ticketing-yocabe.app`
- Deploy automatico da GitHub su Vercel
- Il vecchio `ticketing-app-ashen.vercel.app` può restare come redirect — non cancellarlo subito

---

## Se ti blocchi

Scrivimi:
- “sono al punto A2”
- oppure invia screenshot della pagina Domains su Vercel

Non serve capire DNS o codice — solo copia-incolla gli URL indicati.
