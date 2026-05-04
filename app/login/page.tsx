"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "magic" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy("password");

    if (mode === "signup") {
      // L.8d — Sign up creates an auth.users row. The handle_new_user trigger
      // copies it into public.users. With "Confirm email" disabled in Supabase
      // settings, the user gets a session immediately and we redirect to
      // /onboarding via /auth/post-login (which checks the user has no org
      // and routes accordingly).
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/post-login`,
        },
      });
      setBusy(null);
      if (error) {
        setError(error.message);
        return;
      }
      // If a session came back, the user is signed in (Confirm email OFF path).
      if (data.session) {
        window.location.href = "/auth/post-login";
        return;
      }
      // Otherwise we sent a confirmation email — tell them to check it.
      setInfo("Account created. Check your inbox for the confirmation link to finish signing in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    const dest = next
      ? `/auth/post-login?next=${encodeURIComponent(next)}`
      : "/auth/post-login";
    window.location.href = dest;
  }

  async function handleMagicLink() {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setBusy("magic");
    const origin = window.location.origin;
    const finalNext = next ? `/auth/post-login?next=${encodeURIComponent(next)}` : "/auth/post-login";
    const redirect = `${origin}/auth/callback?next=${encodeURIComponent(finalNext)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect },
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("Check your inbox — we just sent you a magic link.");
  }

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setInfo(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-navy">
            <span className="h-8 w-8 rounded-lg bg-navy text-gold flex items-center justify-center font-serif text-lg font-bold">
              P
            </span>
            <span className="font-serif text-2xl font-bold tracking-tight">Pulso</span>
          </div>
          <p className="text-sm text-muted mt-3">
            Portfolio OS for LATAM venture capital
          </p>
        </div>

        <div className="bg-white rounded-xl border border-line shadow-card p-6 sm:p-8">
          {/* L.8d — sign-in / sign-up toggle */}
          <div className="flex items-center gap-1 p-1 bg-paper2 rounded-lg mb-5">
            <button
              type="button"
              onClick={() => mode !== "signin" && toggleMode()}
              className={`flex-1 h-9 rounded-md text-sm font-semibold transition-colors ${mode === "signin" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => mode !== "signup" && toggleMode()}
              className={`flex-1 h-9 rounded-md text-sm font-semibold transition-colors ${mode === "signup" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              Create account
            </button>
          </div>

          <h1 className="text-lg font-semibold text-ink">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-[13px] text-muted mt-1">
            {mode === "signin"
              ? "Use your email and password, or get a magic link."
              : "We'll create your fund profile in the next step."}
          </p>

          <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold text-ink tracking-wide uppercase mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@fund.com"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-line bg-white text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold text-ink tracking-wide uppercase mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                  required
                  minLength={6}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-line bg-white text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
                />
              </div>
            </div>

            {error && (
              <div className="text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            {info && (
              <div className="text-[12px] text-teal-600 bg-teal-50 border border-teal/20 rounded-md px-3 py-2">
                {info}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              disabled={busy !== null}
            >
              {busy === "password" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {mode === "signup" ? "Creating account…" : "Signing in…"}
                </>
              ) : (
                mode === "signup" ? "Create account" : "Sign in"
              )}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-line" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">or</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          <Button
            type="button"
            variant="gold"
            size="md"
            className="w-full"
            disabled={busy !== null}
            onClick={handleMagicLink}
          >
            {busy === "magic" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Send me a magic link
              </>
            )}
          </Button>

          <p className="text-[11px] text-muted text-center mt-6">
            Trouble signing in? Email{" "}
            <a className="text-navy underline" href="mailto:simon.villena2010@gmail.com">
              support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
