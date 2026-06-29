/** URL pubblico dell'app (Vercel). Usato per redirect email Supabase Auth. */

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
