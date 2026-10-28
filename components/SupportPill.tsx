"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Headphones, MessageCircle, X } from "lucide-react";

/**
 * Optional: set NEXT_PUBLIC_SUPPORT_URL (WhatsApp, Telegram, Discord...) in .env
 * and the panel shows an "Open chat" button that points there.
 */
const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL ?? "";

export default function SupportPill() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            key="support-panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-label="Live support"
            className="glass-strong w-[min(20rem,calc(100vw-2.5rem))] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-white">Live support</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Our team answers day and night. Include your username and order details so we can help faster.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close support panel"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {SUPPORT_URL ? (
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-4 w-full"
              >
                <MessageCircle className="h-4 w-4" />
                Open chat
              </a>
            ) : (
              <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs leading-relaxed text-slate-400">
                Contact the site administrator to get help with orders or wallet top-ups.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="glass-card glow-hover group flex items-center gap-3 rounded-full py-2.5 pl-3 pr-5 text-sm font-medium text-white"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <Headphones className="h-4 w-4 text-violet-300 transition group-hover:text-fuchsia-300" />
        <span>24/7 Live Support</span>
      </button>
    </div>
  );
}
