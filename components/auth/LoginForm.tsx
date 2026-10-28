"use client";

import { useState } from "react";
import { AlertCircle, LogIn, Lock, Mail } from "lucide-react";
import { useFormState } from "react-dom";

import { loginAction } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/types";

import { AuthField, SubmitButton } from "./AuthField";

export default function LoginForm({ next = "/" }: { next?: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(loginAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const failed = state && !state.ok ? state : null;
  const fieldErrors = failed?.fieldErrors ?? {};

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

      <AuthField
        id="login-email"
        name="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        icon={<Mail className="h-4 w-4" />}
        placeholder="you@example.com"
        autoComplete="email"
        errors={fieldErrors.email}
      />

      <AuthField
        id="login-password"
        name="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        icon={<Lock className="h-4 w-4" />}
        placeholder="Your password"
        autoComplete="current-password"
        errors={fieldErrors.password}
      />

      <SubmitButton pendingLabel="Logging in…">
        <LogIn className="h-4 w-4" />
        Log in
      </SubmitButton>
    </form>
  );
}
