"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AtSign, Check, Loader2, Lock, Mail, ShieldCheck, User, UserPlus, X } from "lucide-react";
import { useFormState } from "react-dom";

import { signUpAction } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult } from "@/lib/types";
import { passwordChecks, usernameField } from "@/lib/validation";

import { AuthField, SubmitButton } from "./AuthField";

type UsernameStatus = "idle" | "checking" | "available" | "taken";

export default function RegisterForm({ next = "/" }: { next?: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(signUpAction, null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  const supabase = useMemo(() => createClient(), []);

  const failed = state && !state.ok ? state : null;
  const fieldErrors = failed?.fieldErrors ?? {};

  // Debounced live check against public.is_username_available().
  useEffect(() => {
    if (!usernameField.safeParse(username).success) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("is_username_available", { p_username: username });
        if (cancelled) return;
        if (error) {
          setUsernameStatus("idle");
          return;
        }
        setUsernameStatus(data ? "available" : "taken");
      } catch {
        if (!cancelled) setUsernameStatus("idle");
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, supabase]);

  const checks = passwordChecks(password);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;

  const usernameHint =
    usernameStatus === "checking" ? (
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
      </span>
    ) : usernameStatus === "available" ? (
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <Check className="h-3 w-3" /> Username is available
      </span>
    ) : usernameStatus === "taken" ? (
      <span className="inline-flex items-center gap-1.5 text-red-400">
        <X className="h-3 w-3" /> That username is already taken
      </span>
    ) : (
      "3–24 characters: letters, numbers and underscores."
    );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {failed && (
        <div
          key={failed.error}
          role="alert"
          className="animate-shake flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{failed.error}</span>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <AuthField
          id="reg-name"
          name="name"
          label="Full name"
          value={name}
          onChange={setName}
          icon={<User className="h-4 w-4" />}
          placeholder="Your name"
          autoComplete="name"
          errors={fieldErrors.name}
        />

        <AuthField
          id="reg-username"
          name="username"
          label="Username"
          value={username}
          onChange={(value) => setUsername(value.replace(/\s/g, ""))}
          icon={<AtSign className="h-4 w-4" />}
          placeholder="pick_a_username"
          autoComplete="username"
          errors={fieldErrors.username}
          hint={usernameHint}
        />
      </div>

      <AuthField
        id="reg-email"
        name="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        icon={<Mail className="h-4 w-4" />}
        placeholder="you@example.com"
        autoComplete="email"
        errors={fieldErrors.email}
        hint="No verification email is sent. You can start buying right away."
      />

      <div className="space-y-3">
        <AuthField
          id="reg-password"
          name="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          icon={<Lock className="h-4 w-4" />}
          placeholder="Create a password"
          autoComplete="new-password"
          errors={fieldErrors.password}
        />

        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="Password requirements">
          {checks.map((check) => (
            <li
              key={check.label}
              className={`flex items-center gap-2 text-xs transition-colors ${
                check.passed ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {check.passed ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />}
              {check.label}
            </li>
          ))}
        </ul>
      </div>

      <AuthField
        id="reg-confirm"
        name="confirmPassword"
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        icon={<ShieldCheck className="h-4 w-4" />}
        placeholder="Repeat your password"
        autoComplete="new-password"
        errors={mismatch ? ["Passwords do not match"] : fieldErrors.confirmPassword}
      />

      <SubmitButton pendingLabel="Creating your account…">
        <UserPlus className="h-4 w-4" />
        Create account
      </SubmitButton>
    </form>
  );
}
