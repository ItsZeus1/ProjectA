export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ServiceCheckoutClient, { type CheckoutService } from "@/components/ServiceCheckoutClient";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import type { Category, Profile, ServicePackage } from "@/lib/types";

const SERVICE_COLUMNS =
  "id, slug, name, category, image_url, description, instructions, is_active, " +
  "service_packages(id, service_id, name, normal_price, vip_price, is_active, sort_order)";

type ServiceRow = CheckoutService & {
  is_active: boolean;
  service_packages: ServicePackage[] | null;
};

async function loadService(slug: string): Promise<{ service: ServiceRow | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .select(SERVICE_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();

    if (error) return { service: null, error: error.message };
    return { service: (data as unknown as ServiceRow | null) ?? null, error: null };
  } catch (error) {
    return { service: null, error: error instanceof Error ? error.message : "Could not load this service." };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { service } = await loadService(params.slug);
  return { title: service ? `${service.name} top-up` : "Service" };
}

export default async function ServicePage({ params }: { params: { slug: string } }) {
  const { service, error } = await loadService(params.slug);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div role="alert" className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white">This service could not be loaded</h1>
          <p className="mt-3 text-sm text-slate-400">{error}</p>
          <Link href="/" className="btn-primary mt-6">
            Back to all services
          </Link>
        </div>
      </div>
    );
  }

  // Row Level Security hides inactive services from everyone except admins.
  if (!service) {
    notFound();
  }

  let profile: Profile | null = null;
  try {
    ({ profile } = await getCurrentProfile());
  } catch {
    profile = null;
  }

  const packages = (service.service_packages ?? [])
    .filter((pkg) => pkg.is_active)
    .map((pkg) => ({
      ...pkg,
      normal_price: Number(pkg.normal_price),
      vip_price: Number(pkg.vip_price),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const checkoutService: CheckoutService = {
    id: service.id,
    slug: service.slug,
    name: service.name,
    category: service.category as Category,
    image_url: service.image_url,
    description: service.description,
    instructions: service.instructions,
  };

  return (
    <ServiceCheckoutClient
      service={checkoutService}
      packages={packages}
      role={profile?.role ?? null}
      balance={profile ? Number(profile.balance) : 0}
      loggedIn={Boolean(profile)}
    />
  );
}
