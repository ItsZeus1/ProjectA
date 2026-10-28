"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  EyeOff,
  Gamepad2,
  Headphones,
  LayoutGrid,
  Pencil,
  Search,
  Smartphone,
  Trash2,
  Tv,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { openServiceForm, requestServiceDelete } from "@/lib/events";
import type { Category, PromoBanner, Role, ServiceWithPackages } from "@/lib/types";
import { priceForRole } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABELS, formatMoney } from "@/lib/validation";

/* ------------------------------------------------------------------ */
/* Static maps                                                         */
/* ------------------------------------------------------------------ */
const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  games: Gamepad2,
  apps: AppWindow,
  subscriptions: Tv,
  mobile: Smartphone,
};

const CATEGORY_BLURBS: Record<Category, string> = {
  games: "In-game currency and passes for PUBG, Free Fire, Valorant, Jawaker and more.",
  apps: "Coins and diamonds for TikTok, Bigo Live, SoulChill, Likee and other live apps.",
  subscriptions: "Gift cards and plans for PlayStation, Steam, Netflix, Spotify and iTunes.",
  mobile: "Airtime and data bundles delivered to any phone number in seconds.",
};

const FALLBACK_BANNERS: PromoBanner[] = [
  {
    id: "fallback-1",
    title: "Instant top-ups for every game",
    subtitle: "Pick a package, enter your player ID and get delivery in minutes.",
    badge_text: "Fast delivery",
    cta_label: "Browse games",
    cta_href: "/category/games",
    gradient: "from-violet-600 via-fuchsia-500 to-indigo-600",
    image_url: "",
    is_active: true,
    sort_order: 1,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function startingPrice(service: ServiceWithPackages, role: Role | null): number | null {
  const prices = service.service_packages.map((pkg) => priceForRole(role, pkg));
  return prices.length > 0 ? Math.min(...prices) : null;
}

/* ------------------------------------------------------------------ */
/* Hero promo banner slider                                            */
/* ------------------------------------------------------------------ */
function HeroSlider({ banners, role }: { banners: PromoBanner[]; role: Role | null }) {
  const slides = banners.length > 0 ? banners : FALLBACK_BANNERS;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const isVip = role === "VIP" || role === "ADMIN";

  const go = useCallback(
    (direction: 1 | -1) => setIndex((current) => (current + direction + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => go(1), 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length, go]);

  const slide = slides[index] ?? slides[0];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.8)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={`relative grid min-h-[17rem] items-center gap-6 bg-gradient-to-br ${slide.gradient} p-6 sm:min-h-[19rem] sm:p-10 lg:grid-cols-[1.4fr_1fr]`}
          aria-live="polite"
        >
          {/* Soft light shapes */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-black/30 blur-3xl" />
          </div>

          <div className="relative">
            {slide.badge_text && (
              <span className="animate-float-tilt mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md">
                <Zap className="h-3.5 w-3.5 fill-white" />
                {slide.badge_text}
              </span>
            )}

            <h2 className="max-w-xl text-3xl font-bold text-white sm:text-4xl lg:text-5xl">{slide.title}</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/85 sm:text-base">{slide.subtitle}</p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={slide.cta_href || "/"}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition hover:scale-[1.03] active:scale-[0.98]"
              >
                {slide.cta_label || "Shop now"}
              </Link>

              <span className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-black/25 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-md">
                <Crown className="h-3.5 w-3.5 text-amber-300" />
                {isVip ? "VIP rates are active on your account" : "Upgrade to VIP for lower prices on every package"}
              </span>
            </div>
          </div>

          {/* Floating glass badges */}
          <div aria-hidden className="relative hidden h-full min-h-[11rem] lg:block">
            <div className="animate-float-y absolute right-4 top-0 flex items-center gap-2.5 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-white shadow-xl backdrop-blur-xl">
              <Gamepad2 className="h-5 w-5" />
              <div>
                <p className="font-display text-lg font-bold leading-none">40+</p>
                <p className="mt-1 text-[11px] text-white/80">Games supported</p>
              </div>
            </div>
            <div
              className="animate-float-y-slow absolute left-0 top-1/3 flex items-center gap-2.5 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-white shadow-xl backdrop-blur-xl"
              style={{ animationDelay: "-2s" }}
            >
              <Clock className="h-5 w-5" />
              <div>
                <p className="font-display text-lg font-bold leading-none">&lt; 5 min</p>
                <p className="mt-1 text-[11px] text-white/80">Delivery time</p>
              </div>
            </div>
            <div
              className="animate-float-y absolute bottom-0 right-10 flex items-center gap-2.5 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-white shadow-xl backdrop-blur-xl"
              style={{ animationDelay: "-3.5s" }}
            >
              <Headphones className="h-5 w-5" />
              <div>
                <p className="font-display text-lg font-bold leading-none">24/7</p>
                <p className="mt-1 text-[11px] text-white/80">Live support</p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous promotion"
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/25 bg-black/30 p-2 text-white backdrop-blur-md transition hover:bg-black/50 sm:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next promotion"
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/25 bg-black/30 p-2 text-white backdrop-blur-md transition hover:bg-black/50 sm:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {slides.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Go to promotion ${dotIndex + 1}`}
                aria-current={dotIndex === index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  dotIndex === index ? "w-7 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Service card                                                        */
/* ------------------------------------------------------------------ */
function ServiceCard({
  service,
  role,
  isAdmin,
}: {
  service: ServiceWithPackages;
  role: Role | null;
  isAdmin: boolean;
}) {
  const Icon = CATEGORY_ICONS[service.category];
  const price = startingPrice(service, role);
  const isVip = role === "VIP" || role === "ADMIN";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="group relative"
    >
      <Link
        href={`/service/${service.slug}`}
        className="glass-card glow-hover flex h-full flex-col overflow-hidden"
        aria-label={`${service.name}, ${CATEGORY_LABELS[service.category]}`}
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-violet-900/60 to-indigo-900/60">
          {service.image_url ? (
            <Image
              src={service.image_url}
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Zap className="h-10 w-10 text-violet-300/60" />
            </div>
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#07080D] via-[#07080D]/10 to-transparent" />

          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            <Icon className="h-3 w-3 text-violet-300" />
            {CATEGORY_LABELS[service.category]}
          </span>

          {!service.is_active && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-200 backdrop-blur-md">
              <EyeOff className="h-3 w-3" />
              Hidden from visitors
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-lg font-semibold text-white">{service.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">{service.description}</p>

          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div>
              <p className="text-[11px] text-slate-500">Starting at</p>
              {price !== null ? (
                <p className="font-display text-xl font-bold text-gradient">{formatMoney(price)}</p>
              ) : (
                <p className="text-sm text-slate-500">No packages yet</p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {isVip && price !== null && (
                <span className="badge-vip">
                  <Crown className="h-3 w-3" />
                  VIP Special Rate
                </span>
              )}
              <span className="text-[11px] text-slate-500">
                {service.service_packages.length} {service.service_packages.length === 1 ? "size" : "sizes"}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {isAdmin && (
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={() => openServiceForm({ mode: "edit", slug: service.slug })}
            aria-label={`Edit ${service.name}`}
            className="rounded-lg border border-white/20 bg-black/60 p-2 text-white backdrop-blur-md transition hover:border-violet-400 hover:bg-violet-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => requestServiceDelete({ slug: service.slug, name: service.name })}
            aria-label={`Delete ${service.name}`}
            className="rounded-lg border border-white/20 bg-black/60 p-2 text-white backdrop-blur-md transition hover:border-red-400 hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/* Storefront                                                          */
/* ------------------------------------------------------------------ */
interface StorefrontClientProps {
  services: ServiceWithPackages[];
  banners: PromoBanner[];
  role: Role | null;
  /** Show the hero slider (home) or a category header (category pages). */
  category?: Category | null;
  /** Where the "All" tab points. Guests previewing the store need `/?preview=1`. */
  allHref?: string;
  isGuest?: boolean;
  loadError?: string | null;
}

export default function StorefrontClient({
  services,
  banners,
  role,
  category = null,
  allHref = "/",
  isGuest = false,
  loadError = null,
}: StorefrontClientProps) {
  const [query, setQuery] = useState("");
  const isAdmin = role === "ADMIN";

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter((service) =>
      [service.name, service.slug, service.description, CATEGORY_LABELS[service.category]]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [services, query]);

  const tabs: { key: string; label: string; href: string; icon: LucideIcon }[] = [
    { key: "all", label: "All", href: allHref, icon: LayoutGrid },
    ...CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      href: `/category/${key}`,
      icon: CATEGORY_ICONS[key],
    })),
  ];
  const activeTab = category ?? "all";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      {isGuest && (
        <div className="glass-card mb-6 flex flex-col items-start justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-300">
            You are previewing the storefront. Log in or create an account to see your price and buy.
          </p>
          <div className="flex gap-2">
            <Link href="/login" className="btn-ghost px-3.5 py-2 text-xs">
              Log in
            </Link>
            <Link href="/register" className="btn-primary px-3.5 py-2 text-xs">
              Create account
            </Link>
          </div>
        </div>
      )}

      {category ? (
        <header className="mb-8">
          <span className="pill">
            {(() => {
              const Icon = CATEGORY_ICONS[category];
              return <Icon className="h-3.5 w-3.5 text-violet-300" />;
            })()}
            {CATEGORY_LABELS[category]}
          </span>
          <h1 className="mt-4 text-4xl font-bold text-gradient sm:text-5xl">{CATEGORY_LABELS[category]}</h1>
          <p className="mt-3 max-w-2xl text-slate-400">{CATEGORY_BLURBS[category]}</p>
        </header>
      ) : (
        <div className="mb-10">
          <HeroSlider banners={banners} role={role} />
        </div>
      )}

      {/* Search + tabs */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-white/[0.05] bg-[#07080D]/75 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Service categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
            {tabs.map(({ key, label, href, icon: Icon }) => {
              const active = key === activeTab;
              return (
                <Link
                  key={key}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    active
                      ? "border-violet-500/50 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/20 text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.7)]"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-violet-500/40 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="relative w-full lg:max-w-sm">
            <label htmlFor="service-search" className="sr-only">
              Search services
            </label>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="service-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search PUBG, Netflix, TikTok…"
              className="input-field pl-10 pr-10"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "service" : "services"} found
      </p>

      {loadError ? (
        <div role="alert" className="glass-card border-red-500/30 p-8 text-center">
          <p className="font-display text-lg font-semibold text-white">Services could not be loaded</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            {loadError}. Check that supabase/schema.sql has been run and that your Supabase environment variables are set.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="font-display text-lg font-semibold text-white">
            {query ? `No services match “${query}”` : "No services here yet"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            {query
              ? "Try a different name or clear the search to see everything."
              : isAdmin
                ? "Use Add New Service in the top bar to create the first one."
                : "New services are added regularly. Check back soon."}
          </p>
          {query && (
            <button type="button" onClick={() => setQuery("")} className="btn-ghost mx-auto mt-5">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((service) => (
              <ServiceCard key={service.id} service={service} role={role} isAdmin={isAdmin} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
