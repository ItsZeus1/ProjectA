"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Crown,
  Gamepad2,
  LayoutGrid,
  ListOrdered,
  LogIn,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  UserPlus,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import type { Role } from "@/lib/types";
import { openServiceForm as emitOpenServiceForm } from "@/lib/events";
import { formatMoney } from "@/lib/validation";

export interface NavbarProfile {
  name: string;
  username: string;
  role: Role;
  balance: number;
}

const NAV_LINKS = [
  { href: "/", label: "All Services", icon: LayoutGrid },
  { href: "/category/games", label: "Games", icon: Gamepad2 },
  { href: "/category/apps", label: "Apps", icon: Sparkles },
  { href: "/category/subscriptions", label: "Subscriptions", icon: Tv },
  { href: "/category/mobile", label: "Mobile Charge", icon: Smartphone },
  { href: "/orders", label: "My Orders", icon: ListOrdered },
] as const;

export function RoleBadge({ role }: { role: Role }) {
  if (role === "ADMIN") {
    return (
      <span className="badge-admin">
        <ShieldCheck className="h-3 w-3" />
        ADMIN
      </span>
    );
  }
  if (role === "VIP") {
    return (
      <span className="badge-vip">
        <Crown className="h-3 w-3" />
        VIP
      </span>
    );
  }
  return <span className="badge-normal">NORMAL</span>;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ------------------------------------------------------------------ */
/* Top-up modal                                                        */
/* ------------------------------------------------------------------ */
function TopUpModal({
  profile,
  onClose,
}: {
  profile: NavbarProfile;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(profile.username);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="topup-title"
        className="glass-strong relative w-full max-w-md overflow-hidden p-6"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-600/25 blur-3xl"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-[0_0_24px_-4px_rgba(168,85,247,0.8)]">
            <Wallet className="h-5 w-5 text-white" />
          </div>

          <h2 id="topup-title" className="mt-4 font-display text-xl font-semibold text-white">
            Add funds to your wallet
          </h2>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-400">Current balance</p>
            <p className="mt-1 font-display text-3xl font-bold text-gradient">
              {formatMoney(profile.balance)}
            </p>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Wallet funds are credited by our team after your payment is confirmed. Contact live support, send
            your username and the amount you want to add, and the balance appears here within minutes.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-violet-200/70">Your username</p>
              <p className="truncate font-semibold text-white">{profile.username}</p>
            </div>
            <button type="button" onClick={copyUsername} className="btn-ghost shrink-0 px-3 py-2 text-xs">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <button type="button" onClick={onClose} className="btn-primary mt-5 w-full">
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */
export default function Navbar({ profile }: { profile: NavbarProfile | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const isAdmin = profile?.role === "ADMIN";

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const closeTopUp = useCallback(() => setTopUpOpen(false), []);

  const openServiceForm = () => {
    emitOpenServiceForm({ mode: "create" });
    setMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#07080D]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="NovaCharge home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-indigo-600 shadow-[0_0_22px_-2px_rgba(168,85,247,0.85)] transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
              <Zap className="h-5 w-5 fill-white text-white" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-white [text-shadow:0_0_18px_rgba(167,139,250,0.55)]">
              Nova<span className="text-gradient-brand">Charge</span>
            </span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    active ? "text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 -z-10 rounded-lg border border-violet-500/30 bg-violet-500/15"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            {profile ? (
              <>
                <div className="glass-card flex items-center gap-1 rounded-xl py-1 pl-3 pr-1">
                  <Wallet className="h-4 w-4 text-violet-300" aria-hidden />
                  <span className="px-1.5 font-display text-sm font-semibold text-white" aria-label="Wallet balance">
                    {formatMoney(profile.balance)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTopUpOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Top Up</span>
                  </button>
                </div>

                <span className="hidden sm:inline-flex">
                  <RoleBadge role={profile.role} />
                </span>

                <div className="hidden items-center gap-2 xl:flex">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] font-display text-sm font-semibold text-white"
                    title={profile.name}
                    aria-hidden
                  >
                    {profile.name.slice(0, 1).toUpperCase()}
                  </span>
                  <form action={signOutAction}>
                    <button type="submit" className="btn-ghost px-3 py-2" aria-label="Sign out">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/login" className="btn-ghost">
                  <LogIn className="h-4 w-4" />
                  Log in
                </Link>
                <Link href="/register" className="btn-primary">
                  <UserPlus className="h-4 w-4" />
                  Create account
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="btn-ghost px-3 py-2 xl:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Admin-only strip inside the top bar */}
        {isAdmin && (
          <div className="border-t border-white/[0.05] bg-gradient-to-r from-rose-600/10 via-violet-600/10 to-fuchsia-600/10">
            <div className="mx-auto flex h-11 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
              <p className="hidden items-center gap-2 text-xs font-medium text-rose-200/80 sm:flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrator tools
              </p>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={openServiceForm}
                  className="btn-primary px-3.5 py-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add New Service
                </button>
                <Link
                  href="/admin"
                  className="btn-ghost border-rose-400/30 px-3.5 py-1.5 text-xs hover:border-rose-400/60"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-rose-300" />
                  Admin Panel
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Mobile / tablet drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              key="mobile-drawer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden border-t border-white/[0.06] xl:hidden"
            >
              <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6" aria-label="Mobile">
                {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                        active
                          ? "border border-violet-500/30 bg-violet-500/15 text-white"
                          : "border border-transparent text-slate-300 hover:bg-white/[0.05]"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-violet-300" />
                      {label}
                    </Link>
                  );
                })}

                <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-4">
                  {profile ? (
                    <>
                      <div className="flex items-center justify-between px-1 pb-1">
                        <span className="text-sm text-slate-300">
                          Signed in as <span className="font-semibold text-white">{profile.username}</span>
                        </span>
                        <RoleBadge role={profile.role} />
                      </div>
                      {isAdmin && (
                        <button type="button" onClick={openServiceForm} className="btn-primary w-full">
                          <Plus className="h-4 w-4" />
                          Add New Service
                        </button>
                      )}
                      <form action={signOutAction}>
                        <button type="submit" className="btn-ghost w-full">
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="btn-ghost w-full">
                        <LogIn className="h-4 w-4" />
                        Log in
                      </Link>
                      <Link href="/register" className="btn-primary w-full">
                        <UserPlus className="h-4 w-4" />
                        Create account
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {topUpOpen && profile && <TopUpModal key="topup" profile={profile} onClose={closeTopUp} />}
      </AnimatePresence>
    </>
  );
}
