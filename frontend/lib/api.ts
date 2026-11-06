import { DatasetResult, DatasetColumn, DatasetColumnsResponse, DatasetPreview, TrainingConfig, JobStatus, HistoryEntry, KaggleStatus } from "@/types";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("eazyai_token");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function register(email: string, username: string, password: string) {
  return apiFetch<{ token: string; user: { id: string; email: string; username: string; mfa_enabled: boolean } }>(
    "/api/auth/register",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, username, password }) },
  );
}

export async function login(email: string, password: string, mfaCode?: string) {
  return apiFetch<{ token: string | null; mfa_required: boolean; user?: { id: string; email: string; username: string; mfa_enabled: boolean } }>(
    "/api/auth/login",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, mfa_code: mfaCode }) },
  );
}

export async function getMe() {
  return apiFetch<{ id: string; email: string; username: string; mfa_enabled: boolean; created_at: string }>("/api/auth/me");
}

// ── Profile & Security ────────────────────────────────────────────────────

export async function updateProfile(username?: string, email?: string) {
  return apiFetch("/api/users/profile", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, email }),
  });
}

export async function updatePassword(currentPassword: string, newPassword: string) {
  return apiFetch("/api/users/password", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function setupMfa(): Promise<{ qr_code: string }> {
  return apiFetch("/api/users/mfa/setup", { method: "POST" });
}

export async function enableMfa(code: string) {
  return apiFetch("/api/users/mfa/enable", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
}

export async function disableMfa(code: string) {
  return apiFetch("/api/users/mfa/disable", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
}

// ── API Keys ───────────────────────────────────────────────────────────────

export async function listApiKeys() {
  return apiFetch<{ id: string; name: string; key_preview: string; created_at: string }[]>("/api/users/api-keys");
}

export async function createApiKey(name: string) {
  return apiFetch<{ id: string; name: string; key_preview: string; created_at: string; key: string }>("/api/users/api-keys", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
  });
}

export async function revokeApiKey(keyId: string) {
  return apiFetch(`/api/users/api-keys/${keyId}`, { method: "DELETE" });
}

export async function deleteAccount(password: string) {
  return apiFetch("/api/users/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: password }),
  });
}

// ── Datasets ───────────────────────────────────────────────────────────────

export async function getPopularDatasets(taskType = "text"): Promise<DatasetResult[]> {
  return apiFetch<DatasetResult[]>(`/api/datasets/popular?task_type=${taskType}`);
}

export async function searchDatasets(query: string, taskType = "text", page = 1): Promise<{ results: DatasetResult[]; kaggle_available: boolean; kaggle_error: string | null; has_more: boolean; page: number }> {
  return apiFetch(`/api/datasets/search?q=${encodeURIComponent(query)}&task_type=${taskType}&page=${page}`);
}

export async function getDatasetColumns(datasetId: string, config?: string | null): Promise<DatasetColumnsResponse> {
  const q = config ? `?config=${encodeURIComponent(config)}` : "";
  return apiFetch<DatasetColumnsResponse>(`/api/datasets/columns/${encodeURIComponent(datasetId)}${q}`);
}

export async function getKaggleColumns(ref: string): Promise<{ columns: DatasetColumn[] }> {
  return apiFetch<{ columns: DatasetColumn[] }>("/api/datasets/kaggle-columns", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref }),
  });
}

export async function getDatasetPreview(datasetId: string, config?: string | null): Promise<DatasetPreview> {
  const q = config ? `?config=${encodeURIComponent(config)}` : "";
  return apiFetch<DatasetPreview>(`/api/datasets/preview/${encodeURIComponent(datasetId)}${q}`);
}

// ── Training ───────────────────────────────────────────────────────────────

export async function startTraining(config: TrainingConfig): Promise<{ job_id: string }> {
  return apiFetch<{ job_id: string }>("/api/training/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: config.datasetId, text_column: config.textColumn, label_column: config.labelColumn,
      model_name: config.modelName, num_epochs: config.numEpochs, batch_size: config.batchSize,
      learning_rate: config.learningRate, test_size: config.testSize, max_samples: config.maxSamples,
      preset: config.preset, task_type: config.taskType, config_name: config.configName ?? null,
    }),
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return apiFetch<JobStatus>(`/api/training/status/${jobId}`);
}

export async function cancelTraining(jobId: string): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/training/cancel/${jobId}`, { method: "POST" });
}

export async function getTrainingHistory(): Promise<HistoryEntry[]> {
  return apiFetch<HistoryEntry[]>("/api/training/history");
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function getKaggleStatus(): Promise<KaggleStatus> {
  return apiFetch<KaggleStatus>("/api/settings/kaggle/status");
}

export async function saveKaggleCredentials(username: string, apiKey: string): Promise<KaggleStatus> {
  return apiFetch<KaggleStatus>("/api/settings/kaggle", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, api_key: apiKey }),
  });
}

export async function disconnectKaggle(): Promise<void> {
  await apiFetch("/api/settings/kaggle", { method: "DELETE" });
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
