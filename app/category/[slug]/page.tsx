export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StorefrontClient from "@/components/StorefrontClient";
import { getStorefrontData } from "@/lib/data";
import { getCurrentProfile } from "@/lib/supabase/server";
import type { Category, Profile } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/validation";

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return isCategory(params.slug) ? { title: CATEGORY_LABELS[params.slug] } : { title: "Category not found" };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  if (!isCategory(params.slug)) {
    notFound();
  }

  const category: Category = params.slug;

  let profile: Profile | null = null;
  try {
    ({ profile } = await getCurrentProfile());
  } catch {
    profile = null;
  }

  const { services, banners, error } = await getStorefrontData(category);

  return (
    <StorefrontClient
      services={services}
      banners={banners}
      role={profile?.role ?? null}
      category={category}
      allHref={profile ? "/" : "/?preview=1"}
      isGuest={!profile}
      loadError={error}
    />
  );
}
