import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora } from "next/font/google";

import "./globals.css";

import Navbar, { type NavbarProfile } from "@/components/Navbar";
import ServiceFormModal from "@/components/ServiceFormModal";
import SupportPill from "@/components/SupportPill";
import { getCurrentProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const display = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NovaCharge — Instant game top-ups and digital services",
    template: "%s | NovaCharge",
  },
  description:
    "Top up PUBG, Free Fire, TikTok, Netflix, PlayStation and mobile balances in minutes. VIP members get lower prices on every package.",
};

export const viewport: Viewport = {
  themeColor: "#07080D",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The layout must never crash the site: if Supabase is unreachable or env vars are
  // missing, render as a logged-out visitor instead of throwing.
  let navProfile: NavbarProfile | null = null;
  try {
    const { profile } = await getCurrentProfile();
    if (profile) {
      navProfile = {
        name: profile.name,
        username: profile.username,
        role: profile.role,
        balance: Number(profile.balance),
      };
    }
  } catch {
    navProfile = null;
  }

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body">
        <div className="relative min-h-screen bg-[#07080D] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/30 via-[#0B0D17] to-[#07080D]">
          {/* Ambient glow orbs */}
          <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
            <div className="animate-orb absolute -left-32 top-10 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-[120px]" />
            <div className="animate-orb-reverse absolute -right-24 top-1/3 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/15 blur-[120px]" />
            <div className="animate-orb absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-indigo-600/15 blur-[120px]" />
          </div>

          <div className="relative z-10 flex min-h-screen flex-col">
            <Navbar profile={navProfile} />

            <main className="flex-1">{children}</main>

            <footer className="border-t border-white/[0.06] py-8">
              <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
                <p>© {new Date().getFullYear()} NovaCharge. All rights reserved.</p>
                <p>Instant delivery on games, apps, subscriptions and mobile credit.</p>
              </div>
            </footer>
          </div>

          <SupportPill />

          {/* Listens for the navbar "+ Add New Service" and the card Edit / Delete buttons.
              Every admin action re-checks the role on the server, so this is only a UI gate. */}
          {navProfile?.role === "ADMIN" && <ServiceFormModal />}
        </div>
      </body>
    </html>
  );
}
