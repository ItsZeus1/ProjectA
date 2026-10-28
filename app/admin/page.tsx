export const dynamic = "force-dynamic";

import AdminDashboardClient, {
  type AdminOrder,
  type AdminUser,
} from "@/components/AdminDashboardClient";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { AdminStats, OrderStatus, Role } from "@/lib/types";

interface RawOrder {
  id: string;
  service_name: string;
  package_name: string;
  price: number;
  status: OrderStatus;
  user_ip: string;
  created_at: string;
  profiles: { name: string; username: string } | { name: string; username: string }[] | null;
}

export default async function AdminPage() {
  const { user } = await getCurrentProfile();
  const supabase = await createClient();

  // Admin Row Level Security policies let these queries see every user and order.
  const [statsResult, ordersResult, usersResult] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("orders")
      .select("id, service_name, package_name, price, status, user_ip, created_at, profiles(name, username)")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("profiles")
      .select("id, name, username, email, role, balance, last_ip, last_seen_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const stats: AdminStats = {
    online_sessions: 0,
    total_services: 0,
    total_revenue: 0,
    total_orders: 0,
    total_users: 0,
    ...((statsResult.data as Partial<AdminStats> | null) ?? {}),
  };

  const orders: AdminOrder[] = ((ordersResult.data ?? []) as unknown as RawOrder[]).map((order) => {
    const owner = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    return {
      id: order.id,
      service_name: order.service_name,
      package_name: order.package_name,
      price: Number(order.price),
      status: order.status,
      user_ip: order.user_ip,
      created_at: order.created_at,
      user_name: owner?.name ?? "Unknown user",
      username: owner?.username ?? "",
    };
  });

  const users: AdminUser[] = ((usersResult.data ?? []) as unknown as AdminUser[]).map((row) => ({
    ...row,
    role: row.role as Role,
    balance: Number(row.balance),
  }));

  const loadErrors = [statsResult.error?.message, ordersResult.error?.message, usersResult.error?.message].filter(
    (message): message is string => Boolean(message)
  );

  return (
    <AdminDashboardClient
      stats={{
        online_sessions: Number(stats.online_sessions),
        total_services: Number(stats.total_services),
        total_revenue: Number(stats.total_revenue),
        total_orders: Number(stats.total_orders),
        total_users: Number(stats.total_users),
      }}
      orders={orders}
      users={users}
      currentAdminId={user?.id ?? ""}
      loadErrors={loadErrors}
    />
  );
}
