import type { Metadata } from "next";

import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Log in" };

/** Same-site relative paths only. */
function sanitizeNext(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) {
    return value;
  }
  return "/";
}

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = sanitizeNext(searchParams?.next);
  const registerHref = next === "/" ? "/register" : `/register?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see your wallet, orders and VIP prices."
      footerText="New to NovaCharge?"
      footerLinkLabel="Create an account"
      footerLinkHref={registerHref}
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
