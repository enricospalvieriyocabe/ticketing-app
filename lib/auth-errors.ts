export function translateAuthError(message: string): string {
  const text = message.toLowerCase();

  const secondsMatch = text.match(/after (\d+) seconds?/);
  if (text.includes("security purposes") && secondsMatch) {
    const seconds = secondsMatch[1];
    return `Per sicurezza puoi richiedere una nuova email tra ${seconds} secondi. Attendi e riprova.`;
  }

  if (text.includes("security purposes")) {
    return "Per sicurezza devi attendere circa 60 secondi tra un reinvio e l'altro.";
  }

  if (text.includes("email rate limit") || text.includes("rate limit exceeded")) {
    return "Limite email Supabase raggiunto: con il servizio gratuito arrivano al massimo 2 email all'ora per indirizzo. Attendi circa 1 ora oppure controlla spam per le email già inviate.";
  }

  if (text.includes("too many requests")) {
    return "Troppe richieste in poco tempo. Riprova tra qualche minuto.";
  }

  if (text.includes("email not confirmed") || text.includes("not confirmed")) {
    return "Devi prima confermare l'email. Controlla la casella (anche spam) e clicca il link ricevuto.";
  }

  if (text.includes("invalid login credentials")) {
    return "Credenziali non valide. Controlla email e password.";
  }

  if (text.includes("user already registered")) {
    return "Questa email risulta già registrata.";
  }

  return message;
}

export function parseResendCooldownMs(message: string): number | null {
  const text = message.toLowerCase();
  const secondsMatch = text.match(/after (\d+) seconds?/);
  if (secondsMatch) {
    return Number(secondsMatch[1]) * 1000;
  }
  if (text.includes("security purposes")) {
    return 60_000;
  }
  if (text.includes("email rate limit") || text.includes("rate limit exceeded")) {
    return 60 * 60_000;
  }
  return null;
}
