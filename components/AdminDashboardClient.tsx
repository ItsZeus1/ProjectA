"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
  Wifi,
} from "lucide-react";

import { setUserRoleAction, topUpUserAction } from "@/app/admin/actions";
import { openServiceForm } from "@/lib/events";
import type { AdminStats, OrderStatus, Role } from "@/lib/types";
import { ROLES, formatMoney, isHardcodedAdminEmail } from "@/lib/validation";

export interface AdminOrder {
  id: string;
  service_name: string;
  package_name: string;
  price: number;
  status: OrderStatus;
  user_ip: string;
  created_at: string;
  user_name: string;
  username: string;
}

export interface AdminUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  balance: number;
  last_ip: string | null;
  last_seen_at: string | null;
}

interface Props {
  stats: AdminStats;
  orders: AdminOrder[];
  users: AdminUser[];
  currentAdminId: string;
  loadErrors: string[];
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const ROLE_ACTIVE_STYLES: Record<Role, string> = {
  NORMAL: "bg-slate-500/25 text-white",
  VIP: "bg-gradient-to-r from-amber-300 to-orange-400 text-amber-950",
  ADMIN: "bg-gradient-to-r from-rose-600 to-violet-600 text-white",
};

const ORDER_STATUS_DOT: Record<OrderStatus, string> = {
  COMPLETED: "bg-emerald-400",
  PENDING: "bg-amber-400",
  FAILED: "bg-red-400",
};

/* ------------------------------------------------------------------ */
/* KPI card                                                            */
/* ------------------------------------------------------------------ */
function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  live = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wifi;
  accent: string;
  live?: boolean;
}) {
  return (
    <div className="glass-card glow-hover relative overflow-hidden p-5">
      <div aria-hidden className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl ${accent}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums text-gradient">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{hint}</p>
        </div>
        <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-[0_0_20px_-4px_rgba(168,85,247,0.8)]">
          <Icon className="h-5 w-5 text-white" />
          {live && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[#0B0D17] bg-emerald-400" />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* User row                                                            */
/* ------------------------------------------------------------------ */
function UserRow({
  user,
  isSelf,
  onNotice,
  onChanged,
}: {
  user: AdminUser;
  isSelf: boolean;
  onNotice: (notice: { kind: "success" | "error"; text: string }) => void;
  onChanged: (next: Partial<AdminUser> & { id: string }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, startTransition] = useTransition();
  const permanentAdmin = isHardcodedAdminEmail(user.email);
  const roleLocked = isSelf || permanentAdmin;

  const addFunds = () => {
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value === 0) {
      onNotice({ kind: "error", text: "Enter an amount other than zero." });
      return;
    }

    startTransition(async () => {
      const result = await topUpUserAction({ userId: user.id, amount: value, note: "" });
      if (result.ok && result.data) {
        onChanged({ id: user.id, balance: result.data.balance });
        setAmount("");
        onNotice({
          kind: "success",
          text: `${user.username}: balance is now ${formatMoney(result.data.balance)}.`,
        });
      } else if (!result.ok) {
        onNotice({ kind: "error", text: result.error });
      }
    });
  };

  const changeRole = (role: Role) => {
    if (role === user.role || roleLocked) return;

    startTransition(async () => {
      const result = await setUserRoleAction({ userId: user.id, role });
      if (result.ok) {
        onChanged({ id: user.id, role });
        onNotice({ kind: "success", text: `${user.username} is now ${role}.` });
      } else {
        onNotice({ kind: "error", text: result.error });
      }
    });
  };

  return (
    <li className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] font-display text-sm font-semibold text-white"
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {user.name} <span className="font-normal text-slate-500">@{user.username}</span>
            </p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">IP {user.last_ip || "unknown"}</p>
          </div>
        </div>

        <p className="font-display text-xl font-bold text-gradient">{formatMoney(user.balance)}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label={`Role for ${user.username}`}
          className="flex rounded-lg border border-white/10 bg-black/30 p-0.5"
        >
          {ROLES.map((role) => {
            const active = user.role === role;
            return (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy || (roleLocked && !active)}
                onClick={() => changeRole(role)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${
                  active ? ROLE_ACTIVE_STYLES[role] : "text-slate-400 hover:text-white disabled:opacity-40"
                }`}
              >
                {role}
              </button>
            );
          })}
          {roleLocked && (
            <span
              className="flex items-center px-2 text-slate-500"
              title={permanentAdmin ? "Permanent administrator" : "You cannot change your own role"}
            >
              <Lock className="h-3 w-3" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={`topup-${user.id}`} className="sr-only">
            Amount to add for {user.username}
          </label>
          <input
            id={`topup-${user.id}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFunds();
              }
            }}
            placeholder="Amount"
            className="input-field w-28 py-2"
          />
          <button type="button" onClick={addFunds} disabled={busy} className="btn-primary px-3.5 py-2 text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Top Up User Balance
          </button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */
export default function AdminDashboardClient({ stats, orders, users: initialUsers, currentAdminId, loadErrors }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [refreshing, startRefresh] = useTransition();

  // Pick up fresh data whenever the server re-renders this page.
  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Keep "Online Sessions" and the purchase feed live.
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.name, user.username, user.email, user.last_ip ?? ""].join(" ").toLowerCase().includes(needle)
    );
  }, [users, query]);

  const applyChange = (next: Partial<AdminUser> & { id: string }) => {
    setUsers((current) => current.map((user) => (user.id === next.id ? { ...user, ...next } : user)));
  };

  return (
    <div className="space-y-8">
      {loadErrors.length > 0 && (
        <div role="alert" className="glass-card flex items-start gap-3 border-red-500/30 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="font-semibold">Some dashboard data could not be loaded.</p>
            <p className="mt-1 text-red-200/80">{loadErrors.join(" · ")}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => openServiceForm({ mode: "create" })} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add New Service
        </button>
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          className="btn-ghost"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <section aria-label="Key figures" className="grid gap-5 md:grid-cols-3">
        <KpiCard
          label="Online Sessions"
          value={String(stats.online_sessions)}
          hint="Users active in the last 15 minutes"
          icon={Wifi}
          accent="bg-emerald-500/25"
          live
        />
        <KpiCard
          label="Total Slugs / Services"
          value={String(stats.total_services)}
          hint="Services currently in the catalogue"
          icon={Layers}
          accent="bg-violet-500/25"
        />
        <KpiCard
          label="Total Incomes"
          value={formatMoney(stats.total_revenue)}
          hint={`From ${stats.total_orders} orders · completed orders only`}
          icon={Banknote}
          accent="bg-fuchsia-500/25"
        />
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[28rem_1fr]">
        {/* Recent purchases: medium square widget */}
        <section
          aria-labelledby="recent-heading"
          className="glass-card flex aspect-square w-full flex-col overflow-hidden p-5 lg:max-w-[28rem]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-heading" className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <ShoppingBag className="h-4 w-4 text-violet-300" />
              Recent Purchases
            </h2>
            <span className="pill">{orders.length} latest</span>
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-slate-400">
              Purchases will appear here as soon as customers buy.
            </div>
          ) : (
            <ul className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {orders.map((order) => (
                <li key={order.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{order.service_name}</p>
                      <p className="truncate text-xs text-violet-300">{order.package_name}</p>
                    </div>
                    <p className="shrink-0 font-display text-sm font-bold text-white">{formatMoney(order.price)}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span className="truncate">
                      {order.user_name}
                      {order.username && <span className="text-slate-500"> @{order.username}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${ORDER_STATUS_DOT[order.status]}`}
                        title={order.status}
                        aria-label={order.status}
                      />
                      {timeFormatter.format(new Date(order.created_at))} UTC
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">IP {order.user_ip}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* User & balance manager */}
        <section aria-labelledby="users-heading" className="glass-card flex min-w-0 flex-col p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="users-heading" className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <Users className="h-4 w-4 text-violet-300" />
              Users &amp; balances
              <span className="pill">{users.length}</span>
            </h2>

            <div className="relative w-full sm:w-72">
              <label htmlFor="user-search" className="sr-only">
                Search users
              </label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="user-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email or IP"
                className="input-field py-2 pl-10"
                autoComplete="off"
              />
            </div>
          </div>

          <AnimatePresence>
            {notice && (
              <motion.div
                key={notice.text}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role={notice.kind === "error" ? "alert" : "status"}
                className={`mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                  notice.kind === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/30 bg-red-500/10 text-red-200"
                }`}
              >
                {notice.kind === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                {notice.text}
              </motion.div>
            )}
          </AnimatePresence>

          {filteredUsers.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-slate-400">
              {query ? `No users match “${query}”.` : "No users yet."}
            </p>
          ) : (
            <ul className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentAdminId}
                  onNotice={setNotice}
                  onChanged={applyChange}
                />
              ))}
            </ul>
          )}

          {users.length >= 500 && (
            <p className="mt-3 text-xs text-slate-500">Showing the 500 newest accounts. Use search to narrow the list.</p>
          )}
        </section>
      </div>
    </div>
  );
}
