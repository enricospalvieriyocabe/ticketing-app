/** URL pubblico dell'app (Vercel). Usato per redirect email Supabase Auth. */

/** URL pubblico canonico (produzione Yocabè). */
export const CANONICAL_APP_URL = "https://ticketing-yocabe.app";

/** URL Vercel intermedio (se il .app non è ancora attivo). */
export const VERCEL_APP_URL = "https://ticketing-yocabe.vercel.app";

export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export function authCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`;
}

export function resetPasswordUrl(): string {
  return `${getAppUrl()}/auth/reset-password`;
}
