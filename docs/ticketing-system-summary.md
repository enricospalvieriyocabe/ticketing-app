# Ticketing System Summary

Questa nota raccoglie in un unico posto la sintesi delle modifiche fatte sul sistema ticketing, in particolare sul flusso email inbound/outbound e sulla gestione operativa in UI.

## Obiettivo raggiunto

- Evitare ticket duplicati sulle conversazioni email.
- Rendere tracciabile lo stato delle risposte inviate dal ticket.
- Migliorare UX operativa (distinzione commento interno vs risposta email).
- Rendere assegnazione/SLA piu guidati nel ticket.
- Allineare KPI performance con i ruoli reali che lavorano i ticket.

## Flusso email implementato

### Inbound (Gmail -> Ticket)

- Endpoint: `POST /api/email-ingest`.
- Dedup su `message_id` (`email_ingest_log`).
- Se arriva un messaggio con stesso `thread_id`, viene accodato al ticket esistente (commento + evento), non viene creato ticket nuovo.
- Fallback anti-duplicato aggiuntivo su mittente + subject normalizzato (rimozione prefissi `Re:`, `Fwd:` ecc.) quando il `thread_id` non e affidabile.
- Filtro mittenti interni opzionale tramite env `EMAIL_INGEST_IGNORE_FROM`.

### Outbound (Ticket -> Gmail)

- Endpoint coda risposta: `POST /api/ticket/:id/reply`.
- Le risposte vengono messe in `ticket_email_replies` con stato iniziale `pending`.
- Apps Script preleva da `GET /api/email-replies/pending`.
- Apps Script notifica esito su `POST /api/email-replies/:id/status` (`sent`/`failed`).
- Uso consigliato in Apps Script: reply al thread con `GmailApp.getThreadById(...).reply(...)` per mantenere il filone Gmail.

## Tracciamento stato risposta nel ticket

- Le risposte email inserite dai ticket hanno marker interni nel commento:
  - `[email-reply-id:<id>]`
  - `[email-reply-status:pending|sent|failed]`
- UI mostra badge stato:
  - `In invio`
  - `Inviata`
  - `Errore invio`
- UI nasconde i marker tecnici nel testo mostrato.
- Compatibilita legacy: i vecchi commenti con prefisso testuale (`Risposta cliente (in coda/inviata/errore)`) vengono gestiti senza regressioni.

## Migliorie UX operative

- Distinzione visiva tra:
  - `Commento interno`
  - `Risposta email`
- Composer unificato con toggle modalita (commento/risposta) invece di due box separati.
- Preservazione formato originale testo (a capo/spazi) nella visualizzazione dei messaggi.
- Disattivazione modifica sui commenti tracciati di risposta email.

## Assegnazione ticket

- Auto-assegnazione al primo intervento operatore su ticket non assegnato:
  - primo commento
  - invio risposta email
- Evento tracciato in storico (`auto_assigned`).

## SLA su ticket

- Gestione in dettaglio ticket:
  - evidenza se manca una policy SLA associata
  - invito operativo per team leader
  - selettore policy SLA (solo team leader)
- Su assegnazione policy vengono valorizzati:
  - `sla_policy_id`
  - `sla_hours`
  - `sla_due_at`
  - `sla_status`
- Eventi tracciati: `sla_policy_assigned` / `sla_policy_removed`.

## KPI / Performance

- Fix applicata: la tabella performance include sia `operator` che `team_leader`.
- Prima la metrica ignorava ticket in lavorazione assegnati ai team leader.

## Configurazioni chiave (backend/env)

- `EMAIL_INGEST_TOKEN`
- `EMAIL_INGEST_SYSTEM_USER_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_INGEST_DEFAULT_CATEGORY` (opzionale)
- `EMAIL_INGEST_DEFAULT_PRIORITY` (opzionale)
- `EMAIL_INGEST_IGNORE_FROM` (opzionale)

## Configurazioni chiave (Apps Script)

- Trigger separati (stesso progetto o progetti separati):
  - `pushToTicketing` ogni 5 minuti
  - `processOutboundReplies` ogni 5 minuti
- Label inbound:
  - `to-ticket` (sorgente ingest)
  - `processed-ticket` (processati)
- Logging outbound consigliato per diagnosi:
  - pending code/body
  - item id/to/subject/thread_id
  - status callback code/body

## Tabelle coinvolte

- `tickets`
- `ticket_comments`
- `ticket_events`
- `email_ingest_log`
- `ticket_email_replies`
- `sla_policies`

## File applicativi principali

- `app/api/email-ingest/route.ts`
- `app/api/ticket/[id]/reply/route.ts`
- `app/api/email-replies/[id]/status/route.ts`
- `app/ticket/[id]/page.tsx`
- `app/page.tsx`
- `docs/gmail-custom-ingest.md`

## Note operative importanti

- Se una risposta risulta inviata ma la UI sembra non aggiornata, verificare:
  1. stato reale in `ticket_email_replies`
  2. callback `status` ricevuta con `200`
  3. presenza marker nel commento tracciato
- Per massima affidabilita thread Gmail, preferire `thread.reply(...)` rispetto a `sendEmail(..., { threadId })`.

## Prossimi step consigliati

1. Aggiungere dashboard diagnostica minima per coda email (`pending/sent/failed`).
2. Aggiungere action admin per riallineo marker stato su commenti legacy.
3. Valutare supporto header email (`In-Reply-To`, `References`) per matching ancora piu robusto.
4. Eventuale template HTML firma centralizzato lato configurazione.

