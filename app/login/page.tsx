"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { DeepPanelBackdrop } from "@/components/ui/DeepPanel";
import { Input, Label } from "@/components/ui/Input";

export default function LoginPage() {
  const { logIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await logIn(email, password);
      router.push("/dashboard");
    } catch {
      setError("Couldn't sign you in. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[var(--fx-deep)] px-4 py-10">
      <DeepPanelBackdrop />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2.5 text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-900">
            <MessageCircle size={22} />
            <span aria-hidden className="absolute inset-0 -z-10 rounded-2xl bg-emerald-400/40 blur-lg" />
          </div>
          <h1 className="text-xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-slate-400">Log in to your ChatBooks dashboard</p>
        </div>

        {/* The form itself stays a light card: the inputs are styled for a light
            surface, and a legible form beats a moody one. */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10"
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New to ChatBooks?{" "}
          <Link href="/signup" className="font-medium text-emerald-300 hover:text-emerald-200">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
