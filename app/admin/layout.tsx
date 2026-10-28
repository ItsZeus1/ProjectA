export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { getCurrentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin Control Center" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentProfile();

  if (!user) {
    redirect("/login?next=/admin");
  }

  // Strictly for admins. Everyone else goes back to the storefront.
  if (!profile || profile.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="badge-admin">
            <ShieldCheck className="h-3 w-3" />
            ADMIN
          </span>
          <h1 className="mt-3 text-4xl font-bold text-gradient sm:text-5xl">Admin Control Center</h1>
          <p className="mt-2 max-w-xl text-slate-400">
            Watch live activity, manage services and charge sizes, and look after your users&apos; wallets.
          </p>
        </div>
      </header>

      {children}
    </div>
  );
}
