import type { Metadata } from "next";

import AuthShell from "@/components/auth/AuthShell";
import RegisterForm from "@/components/auth/RegisterForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account" };

/** Same-site relative paths only. */
function sanitizeNext(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) {
    return value;
  }
  return "/";
}

export default function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = sanitizeNext(searchParams?.next);
  const loginHref = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register in seconds. There is no email to confirm, so you can top up right away."
      footerText="Already have an account?"
      footerLinkLabel="Log in"
      footerLinkHref={loginHref}
      wide
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
