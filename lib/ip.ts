import { headers } from "next/headers";

/**
 * Best-effort client IP for Server Actions and Server Components.
 * Behind Vercel / most proxies the first x-forwarded-for entry is the visitor.
 * Returns an empty string when no IP header is present (local development).
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headerList.get("x-real-ip")?.trim() ?? "";
}
