"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  updateProfile, updatePassword, setupMfa, enableMfa, disableMfa,
  listApiKeys, createApiKey, revokeApiKey,
  getKaggleStatus, saveKaggleCredentials, disconnectKaggle,
  deleteAccount,
} from "@/lib/api";
import { KaggleStatus } from "@/types";
import PasswordStrength, { passwordValid } from "@/components/auth/PasswordStrength";

type Tab = "profile" | "security" | "api-keys" | "connections" | "preferences" | "account";

export default function SettingsPage() {
  const { user, login, token, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  const TABS: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "api-keys", label: "API Keys" },
    { id: "connections", label: "Connections" },
    { id: "preferences", label: "Preferences" },
    { id: "account", label: "Account" },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-slate-500 mb-8">Manage your account, security, and integrations.</p>

      <div className="flex gap-1 border-b border-slate-200 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg -mb-px border-b-2 transition-colors ${
              tab === t.id ? "border-violet-600 text-violet-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab user={user} onUpdate={(u) => login(token!, { ...user!, ...u })} />}
      {tab === "security" && <SecurityTab user={user} onMfaChange={(v) => login(token!, { ...user!, mfa_enabled: v })} />}
      {tab === "api-keys" && <ApiKeysTab />}
      {tab === "connections" && <ConnectionsTab />}
      {tab === "preferences" && <PreferencesTab />}
      {tab === "account" && <AccountTab onDeleted={logout} />}
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────

function ProfileTab({ user, onUpdate }: { user: ReturnType<typeof useAuth>["user"]; onUpdate: (u: { username?: string; email?: string }) => void }) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(""); setError("");
    try {
      await updateProfile(username !== user?.username ? username : undefined, email !== user?.email ? email : undefined);
      onUpdate({ username, email });
      setMsg("Profile updated successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={save} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      {msg && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}

// ── Security ───────────────────────────────────────────────────────────────

function SecurityTab({ user, onMfaChange }: { user: ReturnType<typeof useAuth>["user"]; onMfaChange: (v: boolean) => void }) {
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const [mfaStep, setMfaStep] = useState<"idle" | "setup" | "verify">("idle");
  const [qrCode, setQrCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaErr, setMfaErr] = useState("");

  const pwValid = passwordValid(newPw);
  const confirmMatch = confirmPw === newPw && confirmPw !== "";

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwValid || !confirmMatch) return;
    setPwSaving(true); setPwMsg(""); setPwErr("");
    try {
      await updatePassword(curPw, newPw);
      setPwMsg("Password updated successfully.");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      setPwErr(err instanceof Error ? err.message : "Failed to update password.");
    } finally { setPwSaving(false); }
  }

  async function startMfaSetup() {
    setMfaLoading(true); setMfaErr("");
    try {
      const { qr_code } = await setupMfa();
      setQrCode(qr_code);
      setMfaStep("setup");
    } catch (err: unknown) {
      setMfaErr(err instanceof Error ? err.message : "Failed to set up MFA.");
    } finally { setMfaLoading(false); }
  }

  async function confirmMfa() {
    setMfaLoading(true); setMfaErr("");
    try {
      await enableMfa(mfaCode);
      onMfaChange(true);
      setMfaStep("idle"); setMfaCode(""); setQrCode("");
    } catch (err: unknown) {
      setMfaErr(err instanceof Error ? err.message : "Invalid code.");
    } finally { setMfaLoading(false); }
  }

  async function confirmDisableMfa() {
    setMfaLoading(true); setMfaErr("");
    try {
      await disableMfa(mfaCode);
      onMfaChange(false);
      setMfaStep("idle"); setMfaCode("");
    } catch (err: unknown) {
      setMfaErr(err instanceof Error ? err.message : "Invalid code.");
    } finally { setMfaLoading(false); }
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Password */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">Change Password</h3>
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current password</label>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <PasswordStrength password={newPw} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
            <input
              type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required
              className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 ${confirmPw && !confirmMatch ? "border-red-400" : "border-slate-200"}`}
            />
            {confirmPw && !confirmMatch && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span>✗</span> Passwords do not match</p>}
            {confirmMatch && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><span>✓</span> Passwords match</p>}
          </div>
          {pwMsg && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{pwMsg}</p>}
          {pwErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pwErr}</p>}
          <button type="submit" disabled={pwSaving || !pwValid || !confirmMatch || !curPw} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
            {pwSaving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      <hr className="border-slate-200" />

      {/* MFA */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Two-Factor Authentication</h3>
            <p className="text-sm text-slate-500 mt-0.5">Add an extra layer of security to your account.</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${user?.mfa_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {user?.mfa_enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {mfaErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{mfaErr}</p>}

        {!user?.mfa_enabled && mfaStep === "idle" && (
          <button onClick={startMfaSetup} disabled={mfaLoading} className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50">
            {mfaLoading ? "Setting up..." : "Enable 2FA"}
          </button>
        )}

        {mfaStep === "setup" && qrCode && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
            <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 border border-slate-200 rounded-xl" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enter the 6-digit code to confirm</label>
              <input
                type="text" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
                placeholder="000000" maxLength={6} inputMode="numeric"
                className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={confirmMfa} disabled={mfaLoading || mfaCode.length !== 6} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors">
                {mfaLoading ? "Verifying..." : "Confirm & Enable"}
              </button>
              <button onClick={() => { setMfaStep("idle"); setQrCode(""); setMfaCode(""); }} className="text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200">
                Cancel
              </button>
            </div>
          </div>
        )}

        {user?.mfa_enabled && mfaStep === "idle" && (
          <button onClick={() => setMfaStep("verify")} className="text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors">
            Disable 2FA
          </button>
        )}

        {user?.mfa_enabled && mfaStep === "verify" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Enter your authenticator code to disable 2FA:</p>
            <input
              type="text" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)}
              placeholder="000000" maxLength={6} inputMode="numeric" autoFocus
              className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="flex gap-3">
              <button onClick={confirmDisableMfa} disabled={mfaLoading || mfaCode.length !== 6} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors">
                {mfaLoading ? "Verifying..." : "Disable 2FA"}
              </button>
              <button onClick={() => { setMfaStep("idle"); setMfaCode(""); }} className="text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl border border-slate-200">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── API Keys ───────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const [keys, setKeys] = useState<{ id: string; name: string; key_preview: string; created_at: string }[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { listApiKeys().then(setKeys).catch(() => {}); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true); setError("");
    try {
      const created = await createApiKey(newKeyName.trim());
      setNewKey(created.key);
      setKeys((prev) => [{ id: created.id, name: created.name, key_preview: created.key_preview, created_at: created.created_at }, ...prev]);
      setNewKeyName("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create key.");
    } finally { setCreating(false); }
  }

  async function handleRevoke(keyId: string) {
    await revokeApiKey(keyId);
    setKeys((prev) => prev.filter((k) => k.id !== keyId));
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">API Keys</h3>
        <p className="text-sm text-slate-500">Use these keys to connect EazyAI to your own systems.</p>
      </div>

      {newKey && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-emerald-700 mb-2">New key created — copy it now. You won&apos;t see it again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs font-mono break-all text-slate-700">{newKey}</code>
            <button onClick={copyKey} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g. My App)" required
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button type="submit" disabled={creating || !newKeyName.trim()} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors shrink-0">
          {creating ? "Creating..." : "Generate Key"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {keys.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No API keys yet. Generate one above.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm">{k.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{k.key_preview}</p>
              </div>
              <button onClick={() => handleRevoke(k.id)} className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Connections ────────────────────────────────────────────────────────────

function ConnectionsTab() {
  const [status, setStatus] = useState<KaggleStatus | null>(null);
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { getKaggleStatus().then(setStatus).catch(() => setStatus({ connected: false })); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const result = await saveKaggleCredentials(username, apiKey);
      setStatus(result); setSuccess("Connected to Kaggle!"); setUsername(""); setApiKey("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🗄️</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Kaggle</p>
            <p className="text-sm text-slate-500">Search Kaggle datasets alongside HuggingFace.</p>
          </div>
          {status?.connected && <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">Connected</span>}
        </div>

        {status?.connected ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex justify-between items-center">
              <p className="text-sm text-emerald-700">Signed in as <span className="font-semibold">{status.username}</span></p>
              <button onClick={async () => { await disconnectKaggle(); setStatus({ connected: false }); }} className="text-sm text-red-600 hover:text-red-700 font-medium">Disconnect</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              <p className="font-medium mb-1">Get your Kaggle API key:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-500 text-xs">
                <li>Go to kaggle.com → Your profile → Settings</li>
                <li>Scroll to API section → click &quot;Create New Token&quot;</li>
                <li>Copy your username and key from the file</li>
              </ol>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kaggle username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">API key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{success}</p>}
            <button type="submit" disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors">
              {saving ? "Verifying..." : "Save & Connect"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Preferences ────────────────────────────────────────────────────────────

function PreferencesTab() {
  const [defaultTask, setDefaultTask] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("eazyai_default_task") || "text" : "text"
  );
  const [notifyEmail, setNotifyEmail] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("eazyai_notify_email") === "true" : false
  );
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem("eazyai_default_task", defaultTask);
    localStorage.setItem("eazyai_notify_email", String(notifyEmail));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Default task */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">Default Task Type</h3>
        <p className="text-sm text-slate-500 mb-3">Which model type opens by default when you start building.</p>
        <div className="grid grid-cols-2 gap-3">
          {[{ value: "text", label: "📝 Text Classification" }, { value: "image", label: "🖼️ Image Classification" }].map((opt) => (
            <button key={opt.value} type="button" onClick={() => setDefaultTask(opt.value)}
              className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${defaultTask === opt.value ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* Notifications */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">Notifications</h3>
        <p className="text-sm text-slate-500 mb-3">Control how EazyAI notifies you.</p>
        <label className="flex items-center justify-between p-4 border border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 transition-colors">
          <div>
            <p className="text-sm font-medium text-slate-800">Email on training complete</p>
            <p className="text-xs text-slate-400 mt-0.5">Get an email when your model finishes training</p>
          </div>
          <div className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${notifyEmail ? "bg-violet-600" : "bg-slate-200"}`}
            onClick={() => setNotifyEmail(!notifyEmail)}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notifyEmail ? "left-5" : "left-1"}`} />
          </div>
        </label>
        {notifyEmail && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            ⚠️ Email delivery requires server-side configuration. This preference is saved locally for now.
          </p>
        )}
      </div>

      <hr className="border-slate-200" />

      {/* About */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-3">About EazyAI</h3>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
          {[
            { label: "Version", value: "2.0.0" },
            { label: "Powered by", value: "HuggingFace Transformers" },
            { label: "Supported tasks", value: "Text & Image Classification" },
          ].map((r) => (
            <div key={r.label} className="flex justify-between">
              <span className="text-slate-500">{r.label}</span>
              <span className="font-medium text-slate-700">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
        {saved ? "✓ Saved" : "Save Preferences"}
      </button>
    </div>
  );
}

// ── Account ────────────────────────────────────────────────────────────────

function AccountTab({ onDeleted }: { onDeleted: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true); setError("");
    try {
      await deleteAccount(password);
      onDeleted();
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Account info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Account Info</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: "Username", value: user?.username },
            { label: "Email", value: user?.email },
            { label: "2FA", value: user?.mfa_enabled ? "Enabled" : "Disabled" },
          ].map((r) => (
            <div key={r.label} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-500">{r.label}</span>
              <span className="font-medium text-slate-800">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export data */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-1">Export Your Data</h3>
        <p className="text-sm text-slate-500 mb-3">Download a copy of your training history and settings.</p>
        <button
          onClick={() => {
            const data = { history: "Available at /api/training/history", settings: "Preferences stored locally" };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = "eazyai_export.json"; a.click();
          }}
          className="border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          Download Export
        </button>
      </div>

      {/* Danger zone */}
      <div className="border border-red-200 rounded-xl overflow-hidden">
        <div className="bg-red-50 px-5 py-3 border-b border-red-200">
          <p className="text-sm font-semibold text-red-700">Danger Zone</p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 text-sm">Delete account</p>
              <p className="text-xs text-slate-500 mt-0.5">Permanently removes your account and all data. Cannot be undone.</p>
            </div>
            <button onClick={() => setShowDelete(!showDelete)}
              className="shrink-0 border border-red-300 hover:bg-red-50 text-red-600 font-medium text-sm px-4 py-2 rounded-xl transition-colors">
              Delete Account
            </button>
          </div>

          {showDelete && (
            <form onSubmit={handleDelete} className="mt-4 pt-4 border-t border-red-100 space-y-3">
              <p className="text-sm text-red-600 font-medium">Enter your password to confirm deletion:</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your current password"
                required
                className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={deleting || !password}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
                  {deleting ? "Deleting..." : "Yes, delete my account"}
                </button>
                <button type="button" onClick={() => { setShowDelete(false); setPassword(""); setError(""); }}
                  className="border border-slate-200 text-slate-600 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
