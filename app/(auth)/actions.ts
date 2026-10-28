"use server";

import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/types";
import {
  createClient,
  createServiceRoleClient,
  hasServiceRoleKey,
} from "@/lib/supabase/server";
import {
  firstZodError,
  flattenZodErrors,
  formDataToObject,
  isHardcodedAdminEmail,
  loginSchema,
  registerSchema,
} from "@/lib/validation";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Only allow same-site relative redirects (blocks open-redirect attacks). */
function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) {
    return value;
  }
  return "/";
}

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip") ?? "";
}

function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Runs right after every successful sign-in / sign-up:
 *  - forces ADMIN + 10,000.00 for the hardcoded admin email
 *  - records the IP + last-seen time for the admin dashboard
 * Both are best-effort and must never block the login itself.
 */
async function afterSignIn(supabase: ServerSupabase, email: string): Promise<void> {
  try {
    if (isHardcodedAdminEmail(email)) {
      await supabase.rpc("enforce_hardcoded_admin");
    }
    await supabase.rpc("touch_presence", { p_ip: await getClientIp() });
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Sign up                                                             */
/* ------------------------------------------------------------------ */
export async function signUpAction(
  _previousState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: firstZodError(parsed.error),
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { name, username, email, password } = parsed.data;

  // The admin email is reserved: when ADMIN_BOOTSTRAP_PASSWORD is set, only someone who
  // knows it can claim that address. This closes the "register the admin email first" hole.
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (isHardcodedAdminEmail(email) && bootstrapPassword && !secretsMatch(password, bootstrapPassword)) {
    return {
      ok: false,
      error: "This email address is reserved for the site administrator.",
      fieldErrors: { password: ["Use the administrator password for this email."] },
    };
  }

  const supabase = await createClient();

  // Unique username check (callable while logged out).
  const { data: available, error: availabilityError } = await supabase.rpc("is_username_available", {
    p_username: username,
  });
  if (availabilityError) {
    return { ok: false, error: availabilityError.message };
  }
  if (available === false) {
    return {
      ok: false,
      error: "That username is already taken.",
      fieldErrors: { username: ["That username is already taken."] },
    };
  }

  // 1) Preferred path: create an already-confirmed user with the service role.
  // 2) Fallback when no service role key is configured: normal sign-up (the SQL trigger auto-confirms).
  if (hasServiceRoleKey()) {
    const admin = createServiceRoleClient();
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, username } },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  // Start the session right away so the visitor lands logged in.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { ok: false, error: signInError.message };
  }

  await afterSignIn(supabase, email);

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

/* ------------------------------------------------------------------ */
/* Log in                                                              */
/* ------------------------------------------------------------------ */
export async function loginAction(
  _previousState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: firstZodError(parsed.error),
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  let { error } = await supabase.auth.signInWithPassword({ email, password });

  // First-ever login of the pre-made admin: create the account on the fly, but only
  // when the typed password equals the server-side ADMIN_BOOTSTRAP_PASSWORD.
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (
    error &&
    bootstrapPassword &&
    isHardcodedAdminEmail(email) &&
    hasServiceRoleKey() &&
    secretsMatch(password, bootstrapPassword)
  ) {
    const admin = createServiceRoleClient();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Majd", username: "majd" },
    });
    if (!created.error) {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    }
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  await afterSignIn(supabase, email);

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

/* ------------------------------------------------------------------ */
/* Sign out                                                            */
/* ------------------------------------------------------------------ */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
