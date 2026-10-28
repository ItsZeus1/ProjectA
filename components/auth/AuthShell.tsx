import type { ReactNode } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footerText: string;
  footerLinkLabel: string;
  footerLinkHref: string;
  wide?: boolean;
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footerText,
  footerLinkLabel,
  footerLinkHref,
  wide = false,
}: AuthShellProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6">
      <div className={`w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="animate-float-y-slow glass-card relative overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-600/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-fuchsia-600/20 blur-3xl"
          />

          <div className="relative">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-indigo-600 shadow-[0_0_26px_-2px_rgba(168,85,247,0.85)]">
              <Zap className="h-5 w-5 fill-white text-white" />
            </span>

            <h1 className="mt-5 text-3xl font-bold text-gradient">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>

            <div className="mt-7">{children}</div>

            <p className="mt-6 text-center text-sm text-slate-400">
              {footerText}{" "}
              <Link
                href={footerLinkHref}
                className="font-semibold text-violet-300 transition hover:text-fuchsia-300"
              >
                {footerLinkLabel}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
