const IUPITER_ORDER_LIST_BASE =
  "https://cloud.yocabe.com/admin/app/platformorder/list?filter%5Bsearch%5D%5Bvalue%5D=";

export function buildIupiterOrderUrl(orderReference?: string | null): string | null {
  const value = String(orderReference ?? "").trim();
  if (!value) return null;
  return `${IUPITER_ORDER_LIST_BASE}${encodeURIComponent(value)}`;
}
