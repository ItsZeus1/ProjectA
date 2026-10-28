"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  Info,
  Loader2,
  ShoppingBag,
  UserRound,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";

import { purchaseAction, type PurchaseReceipt } from "@/app/service/[slug]/actions";
import type { ActionResult, Category, Role, ServicePackage } from "@/lib/types";
import { priceForRole } from "@/lib/types";
import { CATEGORY_LABELS, formatMoney } from "@/lib/validation";

export interface CheckoutService {
  id: string;
  slug: string;
  name: string;
  category: Category;
  image_url: string;
  description: string;
  instructions: string;
}

interface Props {
  service: CheckoutService;
  packages: ServicePackage[];
  role: Role | null;
  balance: number;
  loggedIn: boolean;
}

/* ------------------------------------------------------------------ */
/* Modal submit button                                                 */
/* ------------------------------------------------------------------ */
function ConfirmButton({ disabled, price }: { disabled: boolean; price: number }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending} className="btn-primary w-full py-3 text-base">
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing…
        </>
      ) : (
        <>Pay {formatMoney(price)}</>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Checkout modal                                                      */
/* ------------------------------------------------------------------ */
function CheckoutModal({
  service,
  pkg,
  price,
  balance,
  isVip,
  onClose,
}: {
  service: CheckoutService;
  pkg: ServicePackage;
  price: number;
  balance: number;
  isVip: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<ActionResult<PurchaseReceipt> | null, FormData>(purchaseAction, null);
  const [targetId, setTargetId] = useState("");

  const failed = state && !state.ok ? state : null;
  const succeeded = state && state.ok ? state : null;
  const receipt = succeeded?.data;
  const shortBy = Math.max(0, Math.round((price - balance) * 100) / 100);
  const insufficient = shortBy > 0;
  const fieldError = failed?.fieldErrors?.targetId?.[0];

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

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="glass-strong relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 sm:rounded-b-2xl"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-violet-600/30 blur-3xl"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {succeeded && receipt ? (
          /* ---------------- Success / pending view ---------------- */
          <div className="relative text-center">
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                receipt.status === "COMPLETED"
                  ? "bg-emerald-500/15 text-emerald-400 shadow-[0_0_40px_-6px_rgba(16,185,129,0.7)]"
                  : "bg-amber-500/15 text-amber-300 shadow-[0_0_40px_-6px_rgba(245,158,11,0.7)]"
              }`}
            >
              {receipt.status === "COMPLETED" ? <CheckCircle2 className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
            </motion.div>

            <h2 id="checkout-title" className="mt-5 text-2xl font-bold text-white">
              {receipt.status === "COMPLETED" ? "Top-up delivered" : "Order is processing"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {receipt.status === "COMPLETED"
                ? `${pkg.name} was sent to ${targetId.trim()}.`
                : "Your payment is held while the provider confirms delivery. Check My Orders for the final status."}
            </p>

            <dl className="mt-6 space-y-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Reference</dt>
                <dd className="font-mono font-semibold text-white">{receipt.reference}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Package</dt>
                <dd className="text-right font-medium text-white">
                  {service.name} · {pkg.name}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Charged</dt>
                <dd className="font-semibold text-white">{formatMoney(receipt.price)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2.5">
                <dt className="text-slate-400">Wallet balance</dt>
                <dd className="font-semibold text-gradient">{formatMoney(receipt.balance)}</dd>
              </div>
            </dl>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                Buy another
              </button>
              <Link href="/orders" className="btn-primary">
                View my orders
              </Link>
            </div>
          </div>
        ) : (
          /* ---------------- Checkout form ---------------- */
          <form action={formAction} className="relative">
            <input type="hidden" name="packageId" value={pkg.id} />

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-[0_0_24px_-4px_rgba(168,85,247,0.8)]">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>

            <h2 id="checkout-title" className="mt-4 text-xl font-semibold text-white">
              Confirm your purchase
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {service.name} · {pkg.name}
            </p>

            {failed && (
              <div
                key={failed.error}
                role="alert"
                className="animate-shake mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{failed.error}</span>
              </div>
            )}

            <div className="mt-5">
              <label htmlFor="checkout-target" className="mb-1.5 block text-sm font-medium text-slate-300">
                Player / Account ID
              </label>
              <div className="relative">
                <UserRound
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden
                />
                <input
                  id="checkout-target"
                  name="targetId"
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  autoFocus
                  required
                  autoComplete="off"
                  placeholder="Enter the ID that should receive the top-up"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby="checkout-target-hint"
                  className="input-field pl-11"
                />
              </div>
              <p
                id="checkout-target-hint"
                className={`mt-1.5 text-xs leading-relaxed ${fieldError ? "text-red-400" : "text-slate-500"}`}
              >
                {fieldError ?? service.instructions}
              </p>
            </div>

            <dl className="mt-5 space-y-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Price</dt>
                <dd className="flex items-center gap-2 font-semibold text-white">
                  {isVip && (
                    <span className="badge-vip">
                      <Crown className="h-3 w-3" />
                      VIP
                    </span>
                  )}
                  {formatMoney(price)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Wallet balance</dt>
                <dd className="font-medium text-white">{formatMoney(balance)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2.5">
                <dt className="text-slate-400">Balance after purchase</dt>
                <dd className={`font-semibold ${insufficient ? "text-red-400" : "text-emerald-400"}`}>
                  {insufficient ? `Short by ${formatMoney(shortBy)}` : formatMoney(balance - price)}
                </dd>
              </div>
            </dl>

            {insufficient && (
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-200/90">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your balance is too low. Use Top Up in the navigation bar to see how to add funds.
              </p>
            )}

            <div className="mt-5">
              <ConfirmButton disabled={insufficient || targetId.trim().length < 3} price={price} />
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Floating wallet + cart summary                                      */
/* ------------------------------------------------------------------ */
function SummaryBox({
  selected,
  price,
  balance,
  isVip,
  loggedIn,
  nextHref,
  onCheckout,
}: {
  selected: ServicePackage | null;
  price: number;
  balance: number;
  isVip: boolean;
  loggedIn: boolean;
  nextHref: string;
  onCheckout: () => void;
}) {
  const insufficient = selected ? balance < price : false;

  return (
    <aside className="glass-card relative overflow-hidden p-5" aria-label="Wallet and cart summary">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-fuchsia-600/20 blur-3xl"
      />

      <div className="relative">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
          <Wallet className="h-4 w-4 text-violet-300" />
          Wallet &amp; cart
        </h2>

        {loggedIn && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
            <p className="text-xs text-slate-400">Wallet balance</p>
            <p className="mt-0.5 font-display text-2xl font-bold text-gradient">{formatMoney(balance)}</p>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mt-4"
            >
              <p className="text-xs text-slate-400">Selected package</p>
              <p className="mt-0.5 font-semibold text-white">{selected.name}</p>

              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Price</dt>
                  <dd className="flex items-center gap-2 font-semibold text-white">
                    {isVip && <Crown className="h-3.5 w-3.5 text-amber-300" aria-label="VIP rate" />}
                    {formatMoney(price)}
                  </dd>
                </div>
                {loggedIn && (
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-400">After purchase</dt>
                    <dd className={`font-semibold ${insufficient ? "text-red-400" : "text-emerald-400"}`}>
                      {insufficient ? "Not enough funds" : formatMoney(balance - price)}
                    </dd>
                  </div>
                )}
              </dl>

              {loggedIn ? (
                <button type="button" onClick={onCheckout} className="btn-primary mt-4 w-full">
                  Continue to checkout
                </button>
              ) : (
                <Link href={nextHref} className="btn-primary mt-4 w-full">
                  Log in to buy
                </Link>
              )}
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400"
            >
              Pick a charge size to see your price and balance here.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export default function ServiceCheckoutClient({ service, packages, role, balance, loggedIn }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const isVip = role === "VIP" || role === "ADMIN";
  const selected = packages.find((pkg) => pkg.id === selectedId) ?? null;
  const selectedPrice = selected ? priceForRole(role, selected) : 0;
  const loginHref = `/login?next=${encodeURIComponent(`/service/${service.slug}`)}`;

  const openCheckout = (pkgId: string) => {
    setSelectedId(pkgId);
    setModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/category/${service.category}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {CATEGORY_LABELS[service.category]}
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0">
          {/* Banner */}
          <section className="glass-card overflow-hidden">
            <div className="relative aspect-[21/9] bg-gradient-to-br from-violet-900/60 to-indigo-900/60">
              {service.image_url ? (
                <Image
                  src={service.image_url}
                  alt=""
                  fill
                  unoptimized
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Zap className="h-14 w-14 text-violet-300/60" />
                </div>
              )}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#07080D] via-[#07080D]/30 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <span className="pill border-white/20 bg-black/40 backdrop-blur-md">
                  {CATEGORY_LABELS[service.category]}
                </span>
                <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{service.name}</h1>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              <p className="max-w-2xl leading-relaxed text-slate-300">{service.description}</p>

              <div className="mt-5 flex items-start gap-3 rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <div>
                  <p className="text-sm font-semibold text-white">How to top up</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{service.instructions}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Packages */}
          <section className="mt-8" aria-labelledby="packages-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="packages-heading" className="text-2xl font-bold text-white">
                Choose a charge size
              </h2>
              {isVip && (
                <span className="badge-vip">
                  <Crown className="h-3 w-3" />
                  VIP rates applied
                </span>
              )}
            </div>

            {packages.length === 0 ? (
              <div className="glass-card mt-5 p-8 text-center text-sm text-slate-400">
                No charge sizes are available for this service right now.
              </div>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {packages.map((pkg, index) => {
                  const price = priceForRole(role, pkg);
                  const active = pkg.id === selectedId;

                  return (
                    <motion.li
                      key={pkg.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={active}
                        onClick={() => setSelectedId(pkg.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(pkg.id);
                          }
                        }}
                        className={`glass-card glow-hover flex h-full cursor-pointer flex-col p-4 ${
                          active ? "border-violet-500/70 bg-violet-500/10 shadow-[0_0_28px_-6px_rgba(139,92,246,0.6)]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-lg font-semibold text-white">{pkg.name}</h3>
                          {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-300" aria-label="Selected" />}
                        </div>

                        <div className="mt-3">
                          <p className="font-display text-2xl font-bold text-gradient">{formatMoney(price)}</p>
                          {isVip && (
                            <span className="badge-vip mt-2 shadow-[0_0_14px_-2px_rgba(251,191,36,0.65)]">
                              <Crown className="h-3 w-3" />
                              VIP Special Rate
                            </span>
                          )}
                        </div>

                        <div className="mt-auto pt-4">
                          {loggedIn ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openCheckout(pkg.id);
                              }}
                              className="btn-primary w-full"
                            >
                              Purchase
                            </button>
                          ) : (
                            <Link
                              href={loginHref}
                              onClick={(event) => event.stopPropagation()}
                              className="btn-ghost w-full"
                            >
                              Log in to buy
                            </Link>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Floating wallet + cart summary (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-28">
            <SummaryBox
              selected={selected}
              price={selectedPrice}
              balance={balance}
              isVip={isVip}
              loggedIn={loggedIn}
              nextHref={loginHref}
              onCheckout={() => setModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Floating summary bar (mobile) */}
      <AnimatePresence>
        {selected && !modalOpen && (
          <motion.div
            key="mobile-summary"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="glass-strong fixed inset-x-3 bottom-20 z-30 flex items-center justify-between gap-3 p-3.5 lg:hidden"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{selected.name}</p>
              <p className="text-xs text-slate-400">
                {formatMoney(selectedPrice)}
                {loggedIn && ` · Balance ${formatMoney(balance)}`}
              </p>
            </div>
            {loggedIn ? (
              <button type="button" onClick={() => setModalOpen(true)} className="btn-primary shrink-0 px-4 py-2">
                Checkout
              </button>
            ) : (
              <Link href={loginHref} className="btn-primary shrink-0 px-4 py-2">
                Log in
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && selected && (
          <CheckoutModal
            key="checkout"
            service={service}
            pkg={selected}
            price={selectedPrice}
            balance={balance}
            isVip={isVip}
            onClose={() => setModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
