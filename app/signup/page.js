"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { Check, X } from "lucide-react";
import { escapeLike } from "@/lib/helpers";
import { USERNAME_RE } from "@/lib/sanitize";
import { Reveal } from "@/components/Reveal";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // status: idle | invalid | checking | available | taken
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  // Real-time username availability check (debounced)
  useEffect(() => {
    const value = username.trim();
    if (!value) {
      setStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", escapeLike(value))
        .limit(1);
      if (error) {
        setStatus("idle");
        return;
      }
      setStatus(data && data.length > 0 ? "taken" : "available");
    }, 400);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [username]);

  // Don't flash the form while auth resolves or before redirecting a signed-in user.
  if (authLoading || user) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center px-4 py-12">
        <p className="mono text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setConfirmMsg("");
    if (status !== "available") {
      setError("Please choose a valid, available username.");
      return;
    }
    setSubmitting(true);

    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } },
    });

    if (signErr) {
      setSubmitting(false);
      setError(signErr.message);
      return;
    }

    // Email already registered (Supabase returns a user with no identities)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setSubmitting(false);
      setError("That email is already registered. Try logging in instead.");
      return;
    }

    // If we have a session, create/sync the profile row now.
    if (data.session && data.user) {
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({ id: data.user.id, username: username.trim(), is_private: false });
      if (profErr) {
        setSubmitting(false);
        // 23505 = unique violation: the username was taken between the check and
        // now (case-insensitive DB index). Surface it clearly.
        setError(
          profErr.code === "23505"
            ? "This username is already taken."
            : profErr.message
        );
        return;
      }
      setSubmitting(false);
      router.push("/");
      router.refresh();
      return;
    }

    // No session => email confirmation is enabled.
    setSubmitting(false);
    setConfirmMsg(
      "Account created! Check your email to confirm, then log in to finish setting up your profile."
    );
  };

  const usernameHint = {
    idle: { text: "3–20 letters, numbers or underscores.", cls: "text-muted", icon: null },
    invalid: { text: "3–20 chars — letters, numbers, underscores only.", cls: "text-red-400", icon: null },
    checking: { text: "Checking availability…", cls: "text-muted", icon: null },
    available: { text: "Username available", cls: "text-accent", icon: <Check size={12} aria-hidden /> },
    taken: { text: "Username already taken", cls: "text-red-400", icon: <X size={12} aria-hidden /> },
  }[status];

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <Reveal className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted">
          Your{" "}
          <span className="text-fg">username</span> is public — your email stays
          private.
        </p>
      </Reveal>

      <Reveal as="form" delay={0.08} onSubmit={submit} className="card flex flex-col gap-4 p-6">
        <div>
          <label className="field-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourhandle"
            className="field-input"
          />
          <p className={`mono mt-1.5 flex items-center gap-1 text-xs ${usernameHint.cls}`}>
            {usernameHint.icon}
            {usernameHint.text}
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="email">
            Email <span className="normal-case text-muted">(private)</span>
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="field-input"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {confirmMsg && (
          <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
            {confirmMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            status !== "available" ||
            !email ||
            password.length < 6
          }
          className="btn btn-primary mt-1 w-full"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </Reveal>

      <Reveal as="p" delay={0.16} className="mono mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </Reveal>
    </div>
  );
}
