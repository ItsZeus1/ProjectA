export const dynamic = "force-dynamic";

import StorefrontClient from "@/components/StorefrontClient";
import WelcomeWizard from "@/components/WelcomeWizard";
import { getStorefrontData } from "@/lib/data";
import { getCurrentProfile } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function HomePage({ searchParams }: { searchParams: { preview?: string } }) {
  let profile: Profile | null = null;
  try {
    ({ profile } = await getCurrentProfile());
  } catch {
    profile = null;
  }

  const wantsPreview = searchParams?.preview === "1";

  // First-time visitors get the 3-step welcome wizard. "Browse Storefront Preview" skips it.
  if (!profile && !wantsPreview) {
    return <WelcomeWizard />;
  }

  const { services, banners, error } = await getStorefrontData();

  return (
    <StorefrontClient
      services={services}
      banners={banners}
      role={profile?.role ?? null}
      allHref={profile ? "/" : "/?preview=1"}
      isGuest={!profile}
      loadError={error}
    />
  );
}
