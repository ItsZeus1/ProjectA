import { createClient } from "@/lib/supabase/server";
import type { Category, PromoBanner, ServicePackage, ServiceWithPackages } from "@/lib/types";

export interface StorefrontData {
  services: ServiceWithPackages[];
  banners: PromoBanner[];
  error: string | null;
}

const SERVICE_COLUMNS =
  "id, slug, name, category, image_url, description, instructions, is_active, sort_order, created_at, updated_at, " +
  "service_packages(id, service_id, name, normal_price, vip_price, is_active, sort_order)";

/**
 * Loads the services (with their charge sizes) and promo banners for the storefront.
 * Row Level Security decides visibility: visitors see active rows, admins also see hidden ones.
 * Never throws: a failure is returned as `error` so the page can render a helpful notice.
 */
export async function getStorefrontData(category?: Category): Promise<StorefrontData> {
  try {
    const supabase = await createClient();

    let servicesQuery = supabase
      .from("services")
      .select(SERVICE_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (category) {
      servicesQuery = servicesQuery.eq("category", category);
    }

    const [servicesResult, bannersResult] = await Promise.all([
      servicesQuery,
      supabase.from("promo_banners").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    ]);

    if (servicesResult.error) {
      return { services: [], banners: [], error: servicesResult.error.message };
    }

    const services = ((servicesResult.data ?? []) as unknown as ServiceWithPackages[]).map((service) => ({
      ...service,
      service_packages: (service.service_packages ?? [])
        .filter((pkg: ServicePackage) => pkg.is_active)
        .map((pkg: ServicePackage) => ({
          ...pkg,
          normal_price: Number(pkg.normal_price),
          vip_price: Number(pkg.vip_price),
        }))
        .sort((a: ServicePackage, b: ServicePackage) => a.sort_order - b.sort_order),
    }));

    const banners = (bannersResult.error ? [] : (bannersResult.data ?? [])) as PromoBanner[];

    return { services, banners, error: null };
  } catch (error) {
    return {
      services: [],
      banners: [],
      error: error instanceof Error ? error.message : "Could not load services.",
    };
  }
}
