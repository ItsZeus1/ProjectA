"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { deleteServiceAction, getServiceForEditAction, saveServiceAction } from "@/app/admin/actions";
import {
  SERVICE_DELETE_EVENT,
  SERVICE_FORM_EVENT,
  type ServiceDeleteEventDetail,
  type ServiceFormEventDetail,
} from "@/lib/events";
import type { Category } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/validation";

/* ------------------------------------------------------------------ */
/* Form state                                                          */
/* ------------------------------------------------------------------ */
interface PackageDraft {
  key: string;
  id?: string;
  name: string;
  normal_price: string;
  vip_price: string;
  api_endpoint: string;
  api_secret_code: string;
}

interface FormDraft {
  id?: string;
  name: string;
  slug: string;
  category: Category;
  image_url: string;
  description: string;
  instructions: string;
  is_active: boolean;
  packages: PackageDraft[];
}

let draftCounter = 0;
const nextKey = () => `pkg-${(draftCounter += 1)}`;

const emptyPackage = (): PackageDraft => ({
  key: nextKey(),
  name: "",
  normal_price: "",
  vip_price: "",
  api_endpoint: "",
  api_secret_code: "",
});

const emptyDraft = (): FormDraft => ({
  name: "",
  slug: "",
  category: "games",
  image_url: "",
  description: "",
  instructions: "",
  is_active: true,
  packages: [emptyPackage()],
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/* ------------------------------------------------------------------ */
/* Small field helpers                                                 */
/* ------------------------------------------------------------------ */
function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-400">
      {messages[0]}
    </p>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-300">
      {children}
    </label>
  );
}

function SecretInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        id={id}
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Secret charge code"
        autoComplete="off"
        aria-invalid={invalid}
        className="input-field pl-11 pr-11"
      />
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-label={revealed ? "Hide secret code" : "Show secret code"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delete confirmation                                                 */
/* ------------------------------------------------------------------ */
function DeleteDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: ServiceDeleteEventDetail;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteServiceAction(target.slug);
      if (result.ok) {
        onDeleted();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={pending ? undefined : onClose}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="glass-strong w-full max-w-sm p-6"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
          <Trash2 className="h-5 w-5" />
        </span>
        <h2 id="delete-title" className="mt-4 text-xl font-semibold text-white">
          Delete {target.name}?
        </h2>
        <p id="delete-desc" className="mt-2 text-sm leading-relaxed text-slate-400">
          This removes the service, all of its charge sizes and their secret API codes. Past orders stay in order
          history. This cannot be undone.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="btn-ghost">
            Keep service
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete service
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Main modal (listens for the navbar + card events)                   */
/* ------------------------------------------------------------------ */
export default function ServiceFormModal() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, startSaving] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<ServiceDeleteEventDetail | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setLoading(false);
    setLoadError(null);
  }, []);

  /* ---- Listen for "+ Add New Service", card Edit and card Delete ---- */
  useEffect(() => {
    const onForm = (event: Event) => {
      const detail = (event as CustomEvent<ServiceFormEventDetail>).detail;
      setFormError(null);
      setFieldErrors({});
      setLoadError(null);
      setOpen(true);

      if (detail.mode === "create") {
        setMode("create");
        setDraft(emptyDraft());
        setSlugTouched(false);
        setLoading(false);
        return;
      }

      setMode("edit");
      setLoading(true);
      setSlugTouched(true);
      getServiceForEditAction(detail.slug)
        .then((result) => {
          if (!result.ok || !result.data) {
            setLoadError(result.ok ? "This service could not be loaded." : result.error);
            return;
          }
          const data = result.data;
          setDraft({
            id: data.id,
            name: data.name,
            slug: data.slug,
            category: data.category,
            image_url: data.image_url,
            description: data.description,
            instructions: data.instructions,
            is_active: data.is_active,
            packages: data.packages.map((pkg) => ({
              key: nextKey(),
              id: pkg.id,
              name: pkg.name,
              normal_price: String(pkg.normal_price),
              vip_price: String(pkg.vip_price),
              api_endpoint: pkg.api_endpoint,
              api_secret_code: pkg.api_secret_code,
            })),
          });
        })
        .catch((error: unknown) => {
          setLoadError(error instanceof Error ? error.message : "This service could not be loaded.");
        })
        .finally(() => setLoading(false));
    };

    const onDelete = (event: Event) => {
      setDeleteTarget((event as CustomEvent<ServiceDeleteEventDetail>).detail);
    };

    window.addEventListener(SERVICE_FORM_EVENT, onForm);
    window.addEventListener(SERVICE_DELETE_EVENT, onDelete);
    return () => {
      window.removeEventListener(SERVICE_FORM_EVENT, onForm);
      window.removeEventListener(SERVICE_DELETE_EVENT, onDelete);
    };
  }, []);

  /* ---- Escape + scroll lock while the form is open ---- */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteTarget && !saving) close();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, deleteTarget, saving, close]);

  /* ---- Draft helpers ---- */
  const update = <K extends keyof FormDraft>(key: K, value: FormDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const updatePackage = (key: string, patch: Partial<PackageDraft>) =>
    setDraft((current) => ({
      ...current,
      packages: current.packages.map((pkg) => (pkg.key === key ? { ...pkg, ...patch } : pkg)),
    }));

  const addPackage = () => setDraft((current) => ({ ...current, packages: [...current.packages, emptyPackage()] }));

  const removePackage = (key: string) =>
    setDraft((current) => ({
      ...current,
      packages: current.packages.length > 1 ? current.packages.filter((pkg) => pkg.key !== key) : current.packages,
    }));

  const errorsFor = (path: string) => fieldErrors[path];

  /* ---- Submit ---- */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    // Quick client-side checks so empty prices are never silently saved as 0.
    const localErrors: Record<string, string[]> = {};
    draft.packages.forEach((pkg, index) => {
      if (!pkg.name.trim()) localErrors[`packages.${index}.name`] = ["Size name is required"];
      if (pkg.normal_price.trim() === "") localErrors[`packages.${index}.normal_price`] = ["Required"];
      if (pkg.vip_price.trim() === "") localErrors[`packages.${index}.vip_price`] = ["Required"];
    });
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setFormError("Fill in the highlighted charge sizes.");
      return;
    }
    setFieldErrors({});

    const payload = {
      id: draft.id ?? "",
      name: draft.name,
      slug: draft.slug,
      category: draft.category,
      image_url: draft.image_url,
      description: draft.description,
      instructions: draft.instructions,
      is_active: draft.is_active,
      packages: draft.packages.map((pkg) => ({
        id: pkg.id ?? "",
        name: pkg.name,
        normal_price: pkg.normal_price,
        vip_price: pkg.vip_price,
        api_endpoint: pkg.api_endpoint,
        api_secret_code: pkg.api_secret_code,
      })),
    };

    startSaving(async () => {
      const result = await saveServiceAction(payload);
      if (result.ok) {
        close();
        router.refresh();
        return;
      }

      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const afterDelete = () => {
    setDeleteTarget(null);
    close();
    router.refresh();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="service-form"
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={saving ? undefined : close}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-form-title"
              className="glass-strong flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-b-none sm:rounded-b-2xl"
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-6 py-4">
                <div>
                  <h2 id="service-form-title" className="text-xl font-semibold text-white">
                    {mode === "create" ? "Add a new service" : "Edit service"}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {mode === "create"
                      ? "Customers see it on the storefront as soon as you save."
                      : "Changes go live for customers as soon as you save."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  disabled={saving}
                  aria-label="Close"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {loading ? (
                <div className="flex flex-1 items-center justify-center gap-3 px-6 py-24 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading service…
                </div>
              ) : loadError ? (
                <div className="px-6 py-16 text-center">
                  <p role="alert" className="text-sm text-red-300">
                    {loadError}
                  </p>
                  <button type="button" onClick={close} className="btn-ghost mt-5">
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
                  <div ref={scrollRef} className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
                    {formError && (
                      <div
                        key={formError}
                        role="alert"
                        className="animate-shake flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Service details */}
                    <section aria-labelledby="details-heading" className="space-y-5">
                      <h3 id="details-heading" className="text-base font-semibold text-white">
                        Service details
                      </h3>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="svc-name">Service name</Label>
                          <input
                            id="svc-name"
                            value={draft.name}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDraft((current) => ({
                                ...current,
                                name: value,
                                slug: slugTouched ? current.slug : slugify(value),
                              }));
                            }}
                            placeholder="PUBG Mobile UC"
                            aria-invalid={Boolean(errorsFor("name"))}
                            className="input-field"
                          />
                          <FieldError id="svc-name-error" messages={errorsFor("name")} />
                        </div>

                        <div>
                          <Label htmlFor="svc-slug">Slug (web address)</Label>
                          <input
                            id="svc-slug"
                            value={draft.slug}
                            onChange={(event) => {
                              setSlugTouched(true);
                              update("slug", event.target.value.toLowerCase().replace(/\s+/g, "-"));
                            }}
                            placeholder="pubg-mobile-uc"
                            aria-invalid={Boolean(errorsFor("slug"))}
                            className="input-field font-mono"
                          />
                          <FieldError id="svc-slug-error" messages={errorsFor("slug")} />
                        </div>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="svc-category">Category</Label>
                          <select
                            id="svc-category"
                            value={draft.category}
                            onChange={(event) => update("category", event.target.value as Category)}
                            className="input-field appearance-none"
                          >
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category} className="bg-[#0B0D17]">
                                {CATEGORY_LABELS[category]} ({category})
                              </option>
                            ))}
                          </select>
                          <FieldError id="svc-category-error" messages={errorsFor("category")} />
                        </div>

                        <div>
                          <Label htmlFor="svc-image">Image URL</Label>
                          <div className="relative">
                            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                            <input
                              id="svc-image"
                              type="url"
                              value={draft.image_url}
                              onChange={(event) => update("image_url", event.target.value)}
                              placeholder="https://…"
                              aria-invalid={Boolean(errorsFor("image_url"))}
                              className="input-field pl-11"
                            />
                          </div>
                          <FieldError id="svc-image-error" messages={errorsFor("image_url")} />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="svc-description">Description</Label>
                        <textarea
                          id="svc-description"
                          rows={3}
                          value={draft.description}
                          onChange={(event) => update("description", event.target.value)}
                          placeholder="What customers get and how fast it arrives."
                          className="input-field resize-y"
                        />
                        <FieldError id="svc-description-error" messages={errorsFor("description")} />
                      </div>

                      <div>
                        <Label htmlFor="svc-instructions">Top-up instructions</Label>
                        <textarea
                          id="svc-instructions"
                          rows={2}
                          value={draft.instructions}
                          onChange={(event) => update("instructions", event.target.value)}
                          placeholder="Tell customers where to find their Player ID. Leave empty to use the default text."
                          className="input-field resize-y"
                        />
                        <FieldError id="svc-instructions-error" messages={errorsFor("instructions")} />
                      </div>

                      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <span>
                          <span className="block text-sm font-medium text-white">Visible to customers</span>
                          <span className="block text-xs text-slate-400">
                            Turn off to hide this service from the storefront while you prepare it.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(event) => update("is_active", event.target.checked)}
                          className="h-5 w-5 accent-violet-500"
                        />
                      </label>
                    </section>

                    {/* Charge sizes */}
                    <section aria-labelledby="sizes-heading" className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 id="sizes-heading" className="text-base font-semibold text-white">
                            Charge sizes
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-400">
                            API endpoint and secret code are only used on the server and are never shown to customers.
                          </p>
                        </div>
                        <button type="button" onClick={addPackage} className="btn-ghost shrink-0 px-3.5 py-2 text-xs">
                          <Plus className="h-3.5 w-3.5" />
                          Add size
                        </button>
                      </div>

                      <FieldError id="packages-error" messages={errorsFor("packages")} />

                      <ul className="space-y-4">
                        <AnimatePresence initial={false}>
                          {draft.packages.map((pkg, index) => (
                            <motion.li
                              key={pkg.key}
                              layout
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <fieldset className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <legend className="px-2 text-xs font-semibold text-violet-300">
                                  Size {index + 1}
                                </legend>

                                <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-start">
                                  <div>
                                    <Label htmlFor={`pkg-name-${pkg.key}`}>Size name</Label>
                                    <input
                                      id={`pkg-name-${pkg.key}`}
                                      value={pkg.name}
                                      onChange={(event) => updatePackage(pkg.key, { name: event.target.value })}
                                      placeholder="660 UC"
                                      aria-invalid={Boolean(errorsFor(`packages.${index}.name`))}
                                      className="input-field"
                                    />
                                    <FieldError id={`pkg-name-error-${pkg.key}`} messages={errorsFor(`packages.${index}.name`)} />
                                  </div>

                                  <div>
                                    <Label htmlFor={`pkg-normal-${pkg.key}`}>Normal price</Label>
                                    <input
                                      id={`pkg-normal-${pkg.key}`}
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="0.01"
                                      value={pkg.normal_price}
                                      onChange={(event) => updatePackage(pkg.key, { normal_price: event.target.value })}
                                      placeholder="9.99"
                                      aria-invalid={Boolean(errorsFor(`packages.${index}.normal_price`))}
                                      className="input-field"
                                    />
                                    <FieldError id={`pkg-normal-error-${pkg.key}`} messages={errorsFor(`packages.${index}.normal_price`)} />
                                  </div>

                                  <div>
                                    <Label htmlFor={`pkg-vip-${pkg.key}`}>
                                      <span className="inline-flex items-center gap-1.5">
                                        VIP price <Crown className="h-3 w-3 text-amber-300" aria-hidden />
                                      </span>
                                    </Label>
                                    <input
                                      id={`pkg-vip-${pkg.key}`}
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="0.01"
                                      value={pkg.vip_price}
                                      onChange={(event) => updatePackage(pkg.key, { vip_price: event.target.value })}
                                      placeholder="8.99"
                                      aria-invalid={Boolean(errorsFor(`packages.${index}.vip_price`))}
                                      className="input-field"
                                    />
                                    <FieldError id={`pkg-vip-error-${pkg.key}`} messages={errorsFor(`packages.${index}.vip_price`)} />
                                  </div>

                                  <div className="sm:pt-7">
                                    <button
                                      type="button"
                                      onClick={() => removePackage(pkg.key)}
                                      disabled={draft.packages.length === 1}
                                      aria-label={`Remove size ${index + 1}`}
                                      className="rounded-xl border border-white/10 p-3 text-slate-400 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <Label htmlFor={`pkg-endpoint-${pkg.key}`}>External API endpoint</Label>
                                    <input
                                      id={`pkg-endpoint-${pkg.key}`}
                                      type="url"
                                      value={pkg.api_endpoint}
                                      onChange={(event) => updatePackage(pkg.key, { api_endpoint: event.target.value })}
                                      placeholder="https://api.provider.com/topup"
                                      aria-invalid={Boolean(errorsFor(`packages.${index}.api_endpoint`))}
                                      className="input-field"
                                    />
                                    <FieldError id={`pkg-endpoint-error-${pkg.key}`} messages={errorsFor(`packages.${index}.api_endpoint`)} />
                                  </div>

                                  <div>
                                    <Label htmlFor={`pkg-secret-${pkg.key}`}>Secret charge code</Label>
                                    <SecretInput
                                      id={`pkg-secret-${pkg.key}`}
                                      value={pkg.api_secret_code}
                                      onChange={(value) => updatePackage(pkg.key, { api_secret_code: value })}
                                      invalid={Boolean(errorsFor(`packages.${index}.api_secret_code`))}
                                    />
                                    <FieldError id={`pkg-secret-error-${pkg.key}`} messages={errorsFor(`packages.${index}.api_secret_code`)} />
                                  </div>
                                </div>
                              </fieldset>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    </section>
                  </div>

                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-black/20 px-6 py-4">
                    {mode === "edit" && draft.slug ? (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ slug: draft.slug, name: draft.name || draft.slug })}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete service
                      </button>
                    ) : (
                      <span />
                    )}

                    <div className="flex items-center gap-3">
                      <button type="button" onClick={close} disabled={saving} className="btn-ghost">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? "Saving…" : mode === "create" ? "Create service" : "Save changes"}
                      </button>
                    </div>
                  </footer>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteDialog
            key="delete-dialog"
            target={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={afterDelete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
