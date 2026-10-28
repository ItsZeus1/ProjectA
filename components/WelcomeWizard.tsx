"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Clock,
  Gamepad2,
  Headphones,
  Store,
  Smartphone,
  Tv,
  Zap,
  type LucideIcon,
} from "lucide-react";

import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";

/* ------------------------------------------------------------------ */
/* Count-up hook (respects prefers-reduced-motion)                     */
/* ------------------------------------------------------------------ */
function useCountUp(target: number, duration = 1700, delay = 250): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    const timeout = window.setTimeout(() => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delay]);

  return value;
}

/* ------------------------------------------------------------------ */
/* Step 1 pieces                                                       */
/* ------------------------------------------------------------------ */
function StatCard({
  icon: Icon,
  target,
  prefix = "",
  suffix = "",
  label,
  floatClass,
  floatDelay,
}: {
  icon: LucideIcon;
  target: number;
  prefix?: string;
  suffix?: string;
  label: string;
  floatClass: string;
  floatDelay: string;
}) {
  const count = useCountUp(target);

  return (
    <div className={floatClass} style={{ animationDelay: floatDelay }}>
      <div className="glass-card glow-hover flex min-w-[13rem] flex-col items-start gap-3 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-[0_0_20px_-4px_rgba(168,85,247,0.8)]">
          <Icon className="h-5 w-5 text-white" />
        </span>
        <div>
          <p className="font-display text-3xl font-bold tabular-nums text-gradient">
            {prefix}
            {count}
            {suffix}
          </p>
          <p className="mt-1 text-sm text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
      {/* Local glow orbs behind the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-orb absolute -left-10 top-0 h-60 w-60 rounded-full bg-violet-600/30 blur-[90px]" />
        <div className="animate-orb-reverse absolute -right-10 bottom-10 h-60 w-60 rounded-full bg-fuchsia-600/25 blur-[90px]" />
      </div>

      <span className="pill border-violet-500/30 bg-violet-500/10 text-violet-200">
        <Zap className="h-3.5 w-3.5 fill-violet-300 text-violet-300" />
        NovaCharge
      </span>

      <h1 className="mt-6 max-w-3xl text-4xl font-extrabold text-gradient sm:text-5xl lg:text-6xl">
        Instant Top-Ups for Every Game &amp; Digital Service
      </h1>

      <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
        Fund one wallet, pick a package and get your credit in minutes: PUBG, Free Fire, TikTok, Netflix,
        PlayStation and mobile airtime in one place.
      </p>

      <div className="mt-12 grid w-full gap-5 sm:grid-cols-3 sm:place-items-center">
        <StatCard
          icon={Gamepad2}
          target={40}
          suffix="+"
          label="Games Supported"
          floatClass="animate-float-y"
          floatDelay="0s"
        />
        <StatCard
          icon={Clock}
          target={5}
          prefix="< "
          suffix=" Min"
          label="Delivery Time"
          floatClass="animate-float-y-slow sm:mt-10"
          floatDelay="-2s"
        />
        <StatCard
          icon={Headphones}
          target={24}
          suffix="/7"
          label="Live Support"
          floatClass="animate-float-y"
          floatDelay="-4s"
        />
      </div>

      <button type="button" onClick={onNext} className="btn-primary animate-glow-pulse mt-12 px-7 py-3.5 text-base">
        Next: Explore Services
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 pieces                                                       */
/* ------------------------------------------------------------------ */
interface Pillar {
  title: string;
  icon: LucideIcon;
  gradient: string;
  glow: string;
  description: string;
  examples: string[];
}

const PILLARS: Pillar[] = [
  {
    title: "Games",
    icon: Gamepad2,
    gradient: "from-violet-500 via-fuchsia-500 to-indigo-500",
    glow: "rgba(139,92,246,0.55)",
    description: "In-game currency, passes and memberships.",
    examples: ["PUBG", "Free Fire", "Valorant", "Jawaker", "Mobile Legends"],
  },
  {
    title: "Apps",
    icon: AppWindow,
    gradient: "from-cyan-400 via-sky-500 to-blue-600",
    glow: "rgba(14,165,233,0.55)",
    description: "Coins and diamonds for live and social apps.",
    examples: ["TikTok Coins", "Bigo Live", "SoulChill", "Likee"],
  },
  {
    title: "Subscriptions",
    icon: Tv,
    gradient: "from-rose-500 via-red-500 to-orange-500",
    glow: "rgba(244,63,94,0.55)",
    description: "Gift cards and plans for streaming and gaming stores.",
    examples: ["PlayStation", "Steam", "Netflix", "Spotify", "iTunes"],
  },
  {
    title: "Mobile Charge",
    icon: Smartphone,
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    glow: "rgba(16,185,129,0.55)",
    description: "Instant telecom airtime and data bundles.",
    examples: ["Airtime", "Data bundles", "Worldwide carriers"],
  },
];

function TiltCard({ children, glow }: { children: ReactNode; glow: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const smoothX = useSpring(rotateX, { stiffness: 220, damping: 20 });
  const smoothY = useSpring(rotateY, { stiffness: 220, damping: 20 });
  const [hovered, setHovered] = useState(false);

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 14);
    rotateX.set(-py * 14);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
    setHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={reset}
      style={{
        rotateX: smoothX,
        rotateY: smoothY,
        transformPerspective: 900,
        boxShadow: hovered ? `0 20px 60px -20px ${glow}` : "0 8px 32px 0 rgba(0,0,0,0.45)",
      }}
      className="h-full rounded-2xl transition-shadow duration-300"
    >
      {children}
    </motion.div>
  );
}

function StepServices({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-gradient sm:text-4xl">Four ways to top up</h2>
        <p className="mt-3 text-slate-400">Everything you buy is paid from the same wallet.</p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map(({ title, icon: Icon, gradient, glow, description, examples }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index, duration: 0.4 }}
          >
            <TiltCard glow={glow}>
              {/* Gradient border */}
              <div className={`h-full rounded-2xl bg-gradient-to-br ${gradient} p-px`}>
                <div className="flex h-full flex-col rounded-[15px] bg-[#0B0D17]/95 p-5 backdrop-blur-xl">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{description}</p>

                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {examples.map((example) => (
                      <li
                        key={example}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300"
                      >
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="btn-ghost px-5 py-3">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button type="button" onClick={onNext} className="btn-primary px-7 py-3 text-base">
          Next: Get Started
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: integrated auth portal                                      */
/* ------------------------------------------------------------------ */
function StepAuth({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mx-auto mb-6 max-w-md text-center">
        <h2 className="text-3xl font-bold text-gradient sm:text-4xl">Get started</h2>
        <p className="mt-3 text-slate-400">Log in or create an account. No email confirmation needed.</p>
      </div>

      <div className="animate-float-y-slow glass-card relative overflow-hidden p-5 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-fuchsia-600/20 blur-3xl"
        />

        <div className="relative">
          <div
            role="tablist"
            aria-label="Account"
            className="relative grid grid-cols-2 rounded-xl border border-white/10 bg-black/30 p-1"
          >
            {(
              [
                { key: "login", label: "Log in" },
                { key: "register", label: "Create account" },
              ] as const
            ).map(({ key, label }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`auth-tab-${key}`}
                  aria-selected={active}
                  aria-controls={`auth-panel-${key}`}
                  onClick={() => setTab(key)}
                  className={`relative z-10 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-tab-pill"
                      className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600 shadow-[0_0_20px_-4px_rgba(168,85,247,0.8)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`auth-panel-${tab}`}
            aria-labelledby={`auth-tab-${tab}`}
            className="mt-6"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
              >
                {tab === "login" ? <LoginForm next="/" /> : <RegisterForm next="/" />}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 border-t border-white/[0.08] pt-5">
            <Link href="/?preview=1" className="btn-ghost w-full">
              <Store className="h-4 w-4" />
              Browse Storefront Preview
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button type="button" onClick={onBack} className="btn-ghost px-5 py-2.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard shell                                                        */
/* ------------------------------------------------------------------ */
const STEP_LABELS = ["Welcome", "Services", "Account"] as const;

export default function WelcomeWizard() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="relative mx-auto min-h-[calc(100vh-9rem)] max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Progress */}
      <ol className="mx-auto mb-12 flex max-w-sm items-center justify-between gap-2" aria-label="Progress">
        {STEP_LABELS.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                onClick={() => goTo(index)}
                aria-current={current ? "step" : undefined}
                className="flex items-center gap-2"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ${
                    current
                      ? "border-violet-400 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-[0_0_18px_-2px_rgba(168,85,247,0.9)]"
                      : done
                        ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                        : "border-white/15 bg-white/[0.04] text-slate-500"
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`hidden text-sm sm:inline ${current ? "text-white" : "text-slate-500"}`}>{label}</span>
              </button>
              {index < STEP_LABELS.length - 1 && (
                <span className="h-px flex-1 bg-gradient-to-r from-violet-500/50 to-white/10" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: direction * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -60 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
        >
          {step === 0 && <StepWelcome onNext={() => goTo(1)} />}
          {step === 1 && <StepServices onNext={() => goTo(2)} onBack={() => goTo(0)} />}
          {step === 2 && <StepAuth onBack={() => goTo(1)} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
