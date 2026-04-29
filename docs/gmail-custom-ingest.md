# Gmail to Ticket (Custom)

Questa integrazione crea ticket reali da Gmail senza Make/n8n.

## 1) SQL su Supabase

Esegui nel SQL Editor:

```sql
create table if not exists public.email_ingest_log (
  id bigserial primary key,
  message_id text not null unique,
  thread_id text,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  from_email text,
  from_name text,
  subject text,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
```

## 2) Variabili ambiente

Aggiungi queste variabili al progetto (locale e produzione):

- `SUPABASE_SERVICE_ROLE_KEY`: service role key del progetto Supabase
- `EMAIL_INGEST_TOKEN`: token segreto usato da Gmail/App Script
- `EMAIL_INGEST_SYSTEM_USER_ID`: UUID utente tecnico da usare in `created_by/requester_id`
- `EMAIL_INGEST_DEFAULT_CATEGORY` (opzionale, default `general`)
- `EMAIL_INGEST_DEFAULT_PRIORITY` (opzionale, default `medium`)

## 3) Endpoint disponibile

`POST /api/email-ingest`

Header:

- `Authorization: Bearer <EMAIL_INGEST_TOKEN>`

Body JSON minimo:

```json
{
  "messageId": "<gmail-message-id>",
  "subject": "Problema login",
  "fromEmail": "utente@example.com",
  "textBody": "Testo email..."
}
```

## 4) Script Gmail (Apps Script)

Puoi usare Apps Script con trigger ogni 1-5 minuti per leggere la label `to-ticket`.

```javascript
function pushToTicketing() {
  const API_URL = "https://TUO-DOMINIO/api/email-ingest";
  const TOKEN = "EMAIL_INGEST_TOKEN";
  const LABEL_TO_READ = "to-ticket";
  const LABEL_PROCESSED = "processed-ticket";

  const source = GmailApp.getUserLabelByName(LABEL_TO_READ);
  if (!source) return;

  let processed = GmailApp.getUserLabelByName(LABEL_PROCESSED);
  if (!processed) processed = GmailApp.createLabel(LABEL_PROCESSED);

  const threads = source.getThreads(0, 20);
  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      const payload = {
        messageId: message.getId(),
        threadId: thread.getId(),
        fromEmail: message.getFrom(),
        subject: message.getSubject(),
        textBody: message.getPlainBody(),
        receivedAt: message.getDate().toISOString(),
      };

      const response = UrlFetchApp.fetch(API_URL, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + TOKEN },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      const ok = response.getResponseCode() >= 200 && response.getResponseCode() < 300;
      if (ok) {
        message.getThread().addLabel(processed);
      }
    }

    thread.removeLabel(source);
  }
}
```

## Note

- Il dedup avviene su `message_id` in `email_ingest_log`.
- Se arriva due volte la stessa email, non crea ticket duplicati.
