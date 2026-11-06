"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { register } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PasswordStrength, { passwordValid } from "@/components/auth/PasswordStrength";

export default function SignupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pwValid = passwordValid(password);
  const confirmMatch = confirm === password && confirm !== "";
  const canSubmit = email && username && pwValid && confirmMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const { token, user } = await register(email, username, password);
      login(token, user);
      router.push(params.get("redirect") || "/train");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-violet-600">EazyAI</Link>
          <p className="text-slate-500 mt-2 text-sm">Create your account</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname" required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password" required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <PasswordStrength password={password} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
              <input
                type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password" required
                className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                  confirm && !confirmMatch ? "border-red-400 focus:ring-red-400" : "border-slate-200"
                }`}
              />
              {confirm && !confirmMatch && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>✗</span> Passwords do not match</p>
              )}
              {confirmMatch && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><span>✓</span> Passwords match</p>
              )}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit" disabled={!canSubmit || loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" /> Creating account...</> : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
