export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, ReceiptText, ShoppingBag, Wallet, XCircle } from "lucide-react";

import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";
import { formatMoney } from "@/lib/validation";

export const metadata: Metadata = { title: "My Orders" };

interface OrderRow {
  id: string;
  service_name: string;
  service_slug: string;
  package_name: string;
  price: number;
  target_id: string;
  status: OrderStatus;
  created_at: string;
}

interface LedgerRow {
  id: string;
  amount: number;
  type: "TOPUP" | "PURCHASE" | "REFUND" | "ADMIN_ADJUST";
  balance_after: number;
  note: string;
  created_at: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return `${dateFormatter.format(new Date(value))} UTC`;
}

const STATUS_STYLES: Record<OrderStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  COMPLETED: {
    label: "Completed",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "Processing",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: Clock,
  },
  FAILED: {
    label: "Refunded",
    className: "border-red-500/30 bg-red-500/10 text-red-300",
    icon: XCircle,
  },
};

const LEDGER_LABELS: Record<LedgerRow["type"], string> = {
  TOPUP: "Wallet top-up",
  PURCHASE: "Purchase",
  REFUND: "Refund",
  ADMIN_ADJUST: "Adjustment",
};

export default async function OrdersPage() {
  const { user } = await getCurrentProfile();
  if (!user) {
    redirect("/login?next=/orders");
  }

  const supabase = await createClient();

  const [ordersResult, ledgerResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, service_name, service_slug, package_name, price, target_id, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("wallet_ledger")
      .select("id, amount, type, balance_after, note, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const orders = ((ordersResult.data ?? []) as OrderRow[]).map((order) => ({ ...order, price: Number(order.price) }));
  const ledger = ((ledgerResult.data ?? []) as LedgerRow[]).map((row) => ({
    ...row,
    amount: Number(row.amount),
    balance_after: Number(row.balance_after),
  }));

  const completed = orders.filter((order) => order.status === "COMPLETED").length;
  const spent = orders
    .filter((order) => order.status !== "FAILED")
    .reduce((sum, order) => sum + order.price, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gradient sm:text-5xl">My Orders</h1>
        <p className="mt-3 max-w-xl text-slate-400">Every top-up you have bought, with its delivery status.</p>
      </header>

      {ordersResult.error && (
        <div role="alert" className="glass-card mb-6 border-red-500/30 p-5 text-sm text-red-200">
          Orders could not be loaded: {ordersResult.error.message}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Orders placed", value: String(orders.length), icon: ShoppingBag },
          { label: "Delivered", value: String(completed), icon: CheckCircle2 },
          { label: "Total spent", value: formatMoney(spent), icon: Wallet },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-[0_0_20px_-4px_rgba(168,85,247,0.8)]">
              <Icon className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="font-display text-2xl font-bold text-white">{value}</p>
              <p className="text-sm text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="sr-only">
            Order history
          </h2>

          {orders.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <ReceiptText className="mx-auto h-10 w-10 text-violet-300/70" />
              <p className="mt-4 font-display text-lg font-semibold text-white">No orders yet</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
                Pick a game, app or subscription and your first order will show up here.
              </p>
              <Link href="/" className="btn-primary mt-6">
                Browse services
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => {
                const status = STATUS_STYLES[order.status];
                const StatusIcon = status.icon;

                return (
                  <li key={order.id} className="glass-card glow-hover p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold text-white">{order.service_name}</p>
                        <p className="mt-0.5 text-sm text-slate-300">{order.package_name}</p>
                        <p className="mt-2 break-all text-xs text-slate-500">
                          Sent to <span className="font-medium text-slate-300">{order.target_id}</span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <p className="font-display text-xl font-bold text-gradient">{formatMoney(order.price)}</p>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                      <span>
                        Ref <span className="font-mono text-slate-300">{order.id.slice(0, 8).toUpperCase()}</span>
                        {" · "}
                        {formatDate(order.created_at)}
                      </span>
                      {order.service_slug && (
                        <Link
                          href={`/service/${order.service_slug}`}
                          className="font-semibold text-violet-300 transition hover:text-fuchsia-300"
                        >
                          Buy again
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-labelledby="wallet-heading">
          <div className="glass-card p-5 lg:sticky lg:top-28">
            <h2 id="wallet-heading" className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <Wallet className="h-4 w-4 text-violet-300" />
              Wallet activity
            </h2>

            {ledger.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">Balance changes will appear here.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {ledger.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-200">{LEDGER_LABELS[row.type]}</p>
                      <p className="truncate text-xs text-slate-500" title={row.note}>
                        {row.note}
                      </p>
                      <p className="text-xs text-slate-600">{formatDate(row.created_at)}</p>
                    </div>
                    <p className={`shrink-0 font-semibold ${row.amount >= 0 ? "text-emerald-400" : "text-slate-200"}`}>
                      {row.amount >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(row.amount))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
