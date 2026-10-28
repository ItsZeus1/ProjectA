"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/lib/ip";
import { createServiceRoleClient, getCurrentProfile, hasServiceRoleKey } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { firstZodError, flattenZodErrors, formDataToObject, purchaseSchema } from "@/lib/validation";

export interface PurchaseReceipt {
  orderId: string;
  reference: string;
  price: number;
  balance: number;
  /** COMPLETED = delivered. PENDING = provider did not answer in time, money is held until support confirms. */
  status: "COMPLETED" | "PENDING";
}

/* ------------------------------------------------------------------ */
/* Error messages for the codes raised by the SQL functions            */
/* ------------------------------------------------------------------ */
const SQL_ERRORS: Record<string, string> = {
  INSUFFICIENT_BALANCE: "Your wallet balance is too low for this package. Add funds and try again.",
  PACKAGE_NOT_FOUND: "This package no longer exists. Refresh the page and pick another size.",
  PACKAGE_UNAVAILABLE: "This package is currently unavailable.",
  INVALID_TARGET: "Enter a valid Player / Account ID.",
  USER_NOT_FOUND: "Your account could not be found. Log in again and retry.",
};

function describeSqlError(message: string): string {
  for (const [code, text] of Object.entries(SQL_ERRORS)) {
    if (message.includes(code)) return text;
  }
  return message;
}

/* ------------------------------------------------------------------ */
/* External provider call                                              */
/* ------------------------------------------------------------------ */
type ProviderOutcome =
  | { kind: "success"; response: Record<string, unknown> }
  | { kind: "failed"; reason: string; response: Record<string, unknown> }
  | { kind: "unknown"; response: Record<string, unknown> };

/** Reserved / documentation hosts (what the seed data uses) are simulated, not called. */
function isSimulatedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".example") ||
    host.endsWith(".test") ||
    host.endsWith(".invalid") ||
    host === "example.com" ||
    host.endsWith(".example.com") ||
    host.endsWith(".example.org") ||
    host.endsWith(".example.net")
  );
}

/** Never let a configured endpoint reach internal networks or cloud metadata services. */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^0\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

async function callProvider(endpoint: string, secretCode: string, targetId: string): Promise<ProviderOutcome> {
  const trimmed = endpoint.trim();

  // No endpoint configured: simulate a successful delivery.
  if (!trimmed) {
    return { kind: "success", response: { simulated: true, reason: "no endpoint configured" } };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      kind: "failed",
      reason: "This service is misconfigured and could not be fulfilled.",
      response: { error: "invalid endpoint url" },
    };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      kind: "failed",
      reason: "This service is misconfigured and could not be fulfilled.",
      response: { error: "unsupported protocol" },
    };
  }

  if (isBlockedHost(url.hostname)) {
    return {
      kind: "failed",
      reason: "This service is misconfigured and could not be fulfilled.",
      response: { error: "endpoint host is not allowed" },
    };
  }

  if (isSimulatedHost(url.hostname)) {
    return { kind: "success", response: { simulated: true, host: url.hostname } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ target_id: targetId, code: secretCode }),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    const rawBody = (await response.text()).slice(0, 2000);
    let body: unknown = rawBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // keep the raw text
    }

    if (response.ok) {
      return { kind: "success", response: { status: response.status, body } };
    }

    return {
      kind: "failed",
      reason: "The provider could not complete this order.",
      response: { status: response.status, body },
    };
  } catch (error) {
    // A timeout means we cannot know whether the top-up was delivered: do NOT refund automatically.
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "unknown", response: { error: "provider timeout" } };
    }
    return {
      kind: "failed",
      reason: "The provider could not be reached.",
      response: { error: error instanceof Error ? error.message : "network error" },
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Purchase                                                            */
/* ------------------------------------------------------------------ */
export async function purchaseAction(
  _previousState: ActionResult<PurchaseReceipt> | null,
  formData: FormData
): Promise<ActionResult<PurchaseReceipt>> {
  const parsed = purchaseSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error), fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { packageId, targetId } = parsed.data;

  // 1. Who is buying? (verified against Supabase, never trusted from the form)
  const { user, profile } = await getCurrentProfile();
  if (!user || !profile) {
    return { ok: false, error: "Log in to complete your purchase." };
  }

  if (!hasServiceRoleKey()) {
    return {
      ok: false,
      error: "Purchases are not available yet: SUPABASE_SERVICE_ROLE_KEY is missing on the server.",
    };
  }

  const admin = createServiceRoleClient();
  const ip = await getClientIp();

  // 2. Atomically check the balance, deduct the role-based price and create a PENDING order.
  const { data: reserved, error: reserveError } = await admin.rpc("purchase_package", {
    p_user_id: user.id,
    p_package_id: packageId,
    p_target_id: targetId,
    p_ip: ip,
  });

  if (reserveError || !reserved) {
    return { ok: false, error: describeSqlError(reserveError?.message ?? "The purchase could not be started.") };
  }

  const { order_id: orderId, price, balance } = reserved as { order_id: string; price: number; balance: number };
  const reference = orderId.slice(0, 8).toUpperCase();

  // 3. Load the hidden endpoint + secret code. They never leave the server.
  const { data: secret } = await admin
    .from("package_secrets")
    .select("api_endpoint, api_secret_code")
    .eq("package_id", packageId)
    .maybeSingle();

  // 4. Send (or simulate) the external API payload { target_id, code }.
  const outcome = await callProvider(secret?.api_endpoint ?? "", secret?.api_secret_code ?? "", targetId);

  revalidatePath("/", "layout");
  revalidatePath("/orders");

  if (outcome.kind === "success") {
    await admin.rpc("complete_order", { p_order_id: orderId, p_response: outcome.response });
    return {
      ok: true,
      message: "Your top-up was delivered.",
      data: { orderId, reference, price: Number(price), balance: Number(balance), status: "COMPLETED" },
    };
  }

  if (outcome.kind === "unknown") {
    return {
      ok: true,
      message: "Your payment is held while the provider confirms delivery.",
      data: { orderId, reference, price: Number(price), balance: Number(balance), status: "PENDING" },
    };
  }

  // 5. Definitive failure: give the money back.
  const { error: refundError } = await admin.rpc("fail_order_and_refund", {
    p_order_id: orderId,
    p_response: outcome.response,
  });

  if (refundError) {
    return {
      ok: false,
      error: `${outcome.reason} The automatic refund did not finish, so contact support with reference ${reference}.`,
    };
  }

  return { ok: false, error: `${outcome.reason} You have not been charged.` };
}
