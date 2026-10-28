export type Role = "NORMAL" | "VIP" | "ADMIN";

export type Category = "games" | "apps" | "subscriptions" | "mobile";

export type OrderStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface Profile {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  balance: number;
  last_ip: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  category: Category;
  image_url: string;
  description: string;
  instructions: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServicePackage {
  id: string;
  service_id: string;
  name: string;
  normal_price: number;
  vip_price: number;
  is_active: boolean;
  sort_order: number;
}

/** Only ever loaded on the server (service role) or inside the admin panel. */
export interface PackageSecret {
  package_id: string;
  api_endpoint: string;
  api_secret_code: string;
}

export interface ServiceWithPackages extends Service {
  service_packages: ServicePackage[];
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  badge_text: string;
  cta_label: string;
  cta_href: string;
  gradient: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
}

export interface Order {
  id: string;
  user_id: string;
  service_id: string | null;
  package_id: string | null;
  service_name: string;
  service_slug: string;
  package_name: string;
  price: number;
  role_at_purchase: Role;
  target_id: string;
  user_ip: string;
  status: OrderStatus;
  api_response: unknown;
  created_at: string;
  completed_at: string | null;
}

export interface AdminStats {
  online_sessions: number;
  total_services: number;
  total_revenue: number;
  total_orders: number;
  total_users: number;
}

/** Standard return shape for every Server Action. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Price a given role is allowed to see. NORMAL -> normal_price, VIP/ADMIN -> vip_price. */
export function priceForRole(
  role: Role | null | undefined,
  pkg: Pick<ServicePackage, "normal_price" | "vip_price">
): number {
  return role === "VIP" || role === "ADMIN" ? Number(pkg.vip_price) : Number(pkg.normal_price);
}
