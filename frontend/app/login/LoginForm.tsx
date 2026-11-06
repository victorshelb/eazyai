"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login as apiLogin } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await apiLogin(email, password, mfaRequired ? mfaCode : undefined);
      if (result.mfa_required) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }
      if (result.token && result.user) {
        login(result.token, result.user);
        router.push(params.get("redirect") || "/train");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-violet-600">EazyAI</Link>
          <p className="text-slate-500 mt-2 text-sm">
            {mfaRequired ? "Enter your authenticator code" : "Sign in to your account"}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!mfaRequired ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password" required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">6-digit code from your authenticator app</label>
                <input
                  type="text" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000000" maxLength={6} inputMode="numeric" autoFocus required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white text-center tracking-widest text-xl font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button type="button" onClick={() => setMfaRequired(false)} className="text-xs text-slate-400 mt-2 hover:underline">
                  ← Back to sign in
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" /> Signing in...</> : mfaRequired ? "Verify" : "Sign In"}
            </button>
          </form>

          {!mfaRequired && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-violet-600 font-medium hover:underline">Create one</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
