"use server";

import { revalidatePath } from "next/cache";

import { createServiceRoleClient, getCurrentProfile, hasServiceRoleKey } from "@/lib/supabase/server";
import type { ActionResult, Category, Role } from "@/lib/types";
import {
  firstZodError,
  flattenZodErrors,
  isHardcodedAdminEmail,
  serviceFormSchema,
  setRoleSchema,
  slugField,
  topUpUserSchema,
} from "@/lib/validation";

const DEFAULT_INSTRUCTIONS =
  "Enter your Player / Account ID exactly as it appears in the app, choose a package and confirm your purchase.";

export interface ServiceEditData {
  id: string;
  name: string;
  slug: string;
  category: Category;
  image_url: string;
  description: string;
  instructions: string;
  is_active: boolean;
  packages: {
    id: string;
    name: string;
    normal_price: number;
    vip_price: number;
    api_endpoint: string;
    api_secret_code: string;
  }[];
}

/* ------------------------------------------------------------------ */
/* Guard: every admin action re-verifies the caller on the server      */
/* ------------------------------------------------------------------ */
async function requireAdmin() {
  const { user, profile } = await getCurrentProfile();

  if (!user || !profile || profile.role !== "ADMIN") {
    return { ok: false as const, error: "Administrator access is required." };
  }
  if (!hasServiceRoleKey()) {
    return { ok: false as const, error: "SUPABASE_SERVICE_ROLE_KEY is missing on the server." };
  }

  return { ok: true as const, db: createServiceRoleClient(), adminId: user.id };
}

function refreshEverything() {
  revalidatePath("/", "layout");
  revalidatePath("/admin");
}

function describeDbError(error: { code?: string; message: string }): ActionResult<never> {
  if (error.code === "23505") {
    if (error.message.includes("slug")) {
      return { ok: false, error: "That slug is already used by another service.", fieldErrors: { slug: ["Slug already in use"] } };
    }
    return { ok: false, error: "Charge size names must be unique within a service." };
  }
  return { ok: false, error: error.message };
}

/* ------------------------------------------------------------------ */
/* Services: create / update                                           */
/* ------------------------------------------------------------------ */
export async function saveServiceAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { db } = auth;

  const parsed = serviceFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error), fieldErrors: flattenZodErrors(parsed.error) };
  }
  const data = parsed.data;

  // Charge size names must be unique inside one service.
  const seen = new Set<string>();
  const duplicates: Record<string, string[]> = {};
  data.packages.forEach((pkg, index) => {
    const key = pkg.name.toLowerCase();
    if (seen.has(key)) duplicates[`packages.${index}.name`] = ["Charge size names must be unique"];
    seen.add(key);
  });
  if (Object.keys(duplicates).length > 0) {
    return { ok: false, error: "Charge size names must be unique.", fieldErrors: duplicates };
  }

  let serviceId = data.id;
  const isNew = !serviceId;

  if (!serviceId) {
    const { data: last } = await db
      .from("services")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: created, error } = await db
      .from("services")
      .insert({
        slug: data.slug,
        name: data.name,
        category: data.category,
        image_url: data.image_url,
        description: data.description,
        instructions: data.instructions || DEFAULT_INSTRUCTIONS,
        is_active: data.is_active,
        sort_order: (last?.sort_order ?? 0) + 1,
      })
      .select("id")
      .single();

    if (error || !created) return describeDbError(error ?? { message: "Service could not be created." });
    serviceId = created.id as string;
  } else {
    const { error } = await db
      .from("services")
      .update({
        slug: data.slug,
        name: data.name,
        category: data.category,
        image_url: data.image_url,
        description: data.description,
        instructions: data.instructions || DEFAULT_INSTRUCTIONS,
        is_active: data.is_active,
      })
      .eq("id", serviceId);

    if (error) return describeDbError(error);
  }

  const rollbackIfNew = async () => {
    if (isNew && serviceId) await db.from("services").delete().eq("id", serviceId);
  };

  // Remove charge sizes the admin deleted from the form.
  const { data: existingRows } = await db.from("service_packages").select("id").eq("service_id", serviceId);
  const existingIds = new Set((existingRows ?? []).map((row) => row.id as string));
  const keptIds = new Set(data.packages.map((pkg) => pkg.id).filter((id): id is string => Boolean(id)));
  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const { error } = await db.from("service_packages").delete().in("id", removedIds);
    if (error) return describeDbError(error);
  }

  // Update existing sizes, insert new ones, keep the form order as sort_order.
  const secrets: { package_id: string; api_endpoint: string; api_secret_code: string }[] = [];

  for (let index = 0; index < data.packages.length; index += 1) {
    const pkg = data.packages[index];
    const values = {
      name: pkg.name,
      normal_price: pkg.normal_price,
      vip_price: pkg.vip_price,
      sort_order: index + 1,
      is_active: true,
    };

    let packageId = pkg.id && existingIds.has(pkg.id) ? pkg.id : undefined;

    if (packageId) {
      const { error } = await db.from("service_packages").update(values).eq("id", packageId);
      if (error) {
        await rollbackIfNew();
        return describeDbError(error);
      }
    } else {
      const { data: inserted, error } = await db
        .from("service_packages")
        .insert({ ...values, service_id: serviceId })
        .select("id")
        .single();
      if (error || !inserted) {
        await rollbackIfNew();
        return describeDbError(error ?? { message: "Charge size could not be created." });
      }
      packageId = inserted.id as string;
    }

    secrets.push({
      package_id: packageId,
      api_endpoint: pkg.api_endpoint,
      api_secret_code: pkg.api_secret_code,
    });
  }

  const { error: secretsError } = await db.from("package_secrets").upsert(secrets, { onConflict: "package_id" });
  if (secretsError) {
    await rollbackIfNew();
    return describeDbError(secretsError);
  }

  refreshEverything();
  return { ok: true, message: isNew ? "Service created." : "Service updated.", data: { slug: data.slug } };
}

/* ------------------------------------------------------------------ */
/* Services: load for editing (includes the hidden API secrets)        */
/* ------------------------------------------------------------------ */
export async function getServiceForEditAction(slug: string): Promise<ActionResult<ServiceEditData>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const { db } = auth;

  const { data: service, error } = await db
    .from("services")
    .select(
      "id, name, slug, category, image_url, description, instructions, is_active, " +
        "service_packages(id, name, normal_price, vip_price, sort_order)"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!service) return { ok: false, error: "This service no longer exists." };

  const row = service as unknown as Omit<ServiceEditData, "packages"> & {
    service_packages: { id: string; name: string; normal_price: number; vip_price: number; sort_order: number }[] | null;
  };

  const packages = [...(row.service_packages ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const packageIds = packages.map((pkg) => pkg.id);

  const { data: secretRows } =
    packageIds.length > 0
      ? await db.from("package_secrets").select("package_id, api_endpoint, api_secret_code").in("package_id", packageIds)
      : { data: [] as { package_id: string; api_endpoint: string; api_secret_code: string }[] };

  const secretsById = new Map((secretRows ?? []).map((secret) => [secret.package_id as string, secret]));

  return {
    ok: true,
    data: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      image_url: row.image_url,
      description: row.description,
      instructions: row.instructions,
      is_active: row.is_active,
      packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        normal_price: Number(pkg.normal_price),
        vip_price: Number(pkg.vip_price),
        api_endpoint: secretsById.get(pkg.id)?.api_endpoint ?? "",
        api_secret_code: secretsById.get(pkg.id)?.api_secret_code ?? "",
      })),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Services: delete (cascades to charge sizes and secrets)             */
/* ------------------------------------------------------------------ */
export async function deleteServiceAction(slug: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsedSlug = slugField.safeParse(slug);
  if (!parsedSlug.success) return { ok: false, error: "Invalid service." };

  const { error } = await auth.db.from("services").delete().eq("slug", parsedSlug.data);
  if (error) return { ok: false, error: error.message };

  refreshEverything();
  return { ok: true, message: "Service deleted." };
}

/* ------------------------------------------------------------------ */
/* Users: add funds                                                    */
/* ------------------------------------------------------------------ */
export async function topUpUserAction(input: unknown): Promise<ActionResult<{ balance: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = topUpUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error), fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { userId, amount, note } = parsed.data;

  const { data, error } = await auth.db.rpc("admin_adjust_balance", {
    p_admin_id: auth.adminId,
    p_user_id: userId,
    p_amount: amount,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("USER_NOT_FOUND")) return { ok: false, error: "That user no longer exists." };
    if (error.message.includes("INVALID_AMOUNT")) return { ok: false, error: "Enter an amount other than zero." };
    if (error.message.includes("check constraint")) return { ok: false, error: "A balance cannot go below zero." };
    return { ok: false, error: error.message };
  }

  refreshEverything();
  return { ok: true, message: "Balance updated.", data: { balance: Number(data) } };
}

/* ------------------------------------------------------------------ */
/* Users: change role                                                  */
/* ------------------------------------------------------------------ */
export async function setUserRoleAction(input: unknown): Promise<ActionResult<{ role: Role }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = setRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error), fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { userId, role } = parsed.data;

  if (userId === auth.adminId) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const { data: target, error: lookupError } = await auth.db
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (lookupError) return { ok: false, error: lookupError.message };
  if (!target) return { ok: false, error: "That user no longer exists." };
  if (isHardcodedAdminEmail(target.email as string)) {
    return { ok: false, error: "This account is the permanent administrator and cannot be changed." };
  }

  const { error } = await auth.db.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  refreshEverything();
  return { ok: true, message: `Role set to ${role}.`, data: { role } };
}
