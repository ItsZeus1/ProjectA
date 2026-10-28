import { z } from "zod";

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------
export const ROLES = ["NORMAL", "VIP", "ADMIN"] as const;
export const CATEGORIES = ["games", "apps", "subscriptions", "mobile"] as const;

export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  games: "Games",
  apps: "Apps",
  subscriptions: "Subscriptions",
  mobile: "Mobile Charge",
};

/** The account that is automatically promoted to ADMIN with a 10,000.00 balance. */
export const HARDCODED_ADMIN_EMAIL = "majd@elmadani.com";

export function isHardcodedAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === HARDCODED_ADMIN_EMAIL;
}

// ---------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------
const emailField = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordField = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const usernameField = z
  .string({ required_error: "Username is required" })
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores are allowed");

export const slugField = z
  .string({ required_error: "Slug is required" })
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(64, "Slug must be at most 64 characters")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens (e.g. pubg-mobile-uc)");

const moneyField = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(1_000_000, `${label} is too large`)
    .transform((value) => Math.round(value * 100) / 100);

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
export const loginSchema = z.object({
  email: emailField,
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z
      .string({ required_error: "Name is required" })
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name must be at most 60 characters"),
    username: usernameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string({ required_error: "Please confirm your password" }).min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------
export const purchaseSchema = z.object({
  packageId: z.string().uuid("Invalid package"),
  targetId: z
    .string({ required_error: "Player / Account ID is required" })
    .trim()
    .min(3, "Player / Account ID must be at least 3 characters")
    .max(64, "Player / Account ID must be at most 64 characters")
    .regex(/^[\w@.\-+:#\s]+$/, "Player / Account ID contains invalid characters"),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export const packageSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  name: z.string().trim().min(1, "Size name is required").max(80, "Size name is too long"),
  normal_price: moneyField("Normal price"),
  vip_price: moneyField("VIP price"),
  api_endpoint: z
    .string()
    .trim()
    .max(500, "Endpoint is too long")
    .refine((value) => value === "" || /^https?:\/\//i.test(value), "Endpoint must start with http:// or https://")
    .default(""),
  api_secret_code: z.string().trim().max(256, "Secret code is too long").default(""),
});

export const serviceFormSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  name: z.string().trim().min(2, "Service name is required").max(80, "Service name is too long"),
  slug: slugField,
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: "Choose a category" }) }),
  image_url: z.string().trim().url("Enter a valid image URL").or(z.literal("")).default(""),
  description: z.string().trim().max(1000, "Description is too long").default(""),
  instructions: z.string().trim().max(1000, "Instructions are too long").default(""),
  is_active: z.boolean().default(true),
  packages: z
    .array(packageSchema)
    .min(1, "Add at least one charge size")
    .max(40, "A service can have at most 40 charge sizes"),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;
export type PackageFormInput = z.infer<typeof packageSchema>;

export const topUpUserSchema = z.object({
  userId: z.string().uuid("Invalid user"),
  amount: z.coerce
    .number({ invalid_type_error: "Amount must be a number" })
    .refine((value) => value !== 0, "Amount cannot be zero")
    .refine((value) => Math.abs(value) <= 100_000, "Amount is too large")
    .transform((value) => Math.round(value * 100) / 100),
  note: z.string().trim().max(200, "Note is too long").optional().default(""),
});

export const setRoleSchema = z.object({
  userId: z.string().uuid("Invalid user"),
  role: z.enum(ROLES, { errorMap: () => ({ message: "Invalid role" }) }),
});

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** Turn a ZodError into `{ fieldName: [messages] }` for forms. Nested paths use dots (packages.0.name). */
export function flattenZodErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

/** First error message in a ZodError, handy for toasts. */
export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Read a FormData into a plain object, keeping only string values. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

/** Live password-strength checklist for the register form. */
export function passwordChecks(password: string) {
  return [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "One uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "One lowercase letter", passed: /[a-z]/.test(password) },
    { label: "One number", passed: /[0-9]/.test(password) },
  ];
}

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number.isFinite(amount) ? amount : 0
  );
}
