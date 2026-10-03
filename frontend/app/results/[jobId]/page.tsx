"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { JobStatus, TrainingResults } from "@/types";
import { getJobStatus, cancelTraining } from "@/lib/api";

async function predictText(jobId: string, text: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("eazyai_token") : null;
  const res = await fetch(`/api/training/predict/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Prediction failed");
  return res.json() as Promise<{ predictions: { label: string; score: number }[] }>;
}

async function predictImage(jobId: string, file: File) {
  const token = typeof window !== "undefined" ? localStorage.getItem("eazyai_token") : null;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/training/predict-image/${jobId}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Prediction failed");
  return res.json() as Promise<{ predictions: { label: string; score: number }[] }>;
}

// ── Try-it-out component ───────────────────────────────────────────────────

function TryItOut({ jobId, results }: { jobId: string; results: TrainingResults }) {
  const isImage = results.task_type === "image";
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [predictions, setPredictions] = useState<{ label: string; score: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePredict() {
    setLoading(true); setError(""); setPredictions([]);
    try {
      if (isImage && imageFile) {
        const { predictions: preds } = await predictImage(jobId, imageFile);
        setPredictions(preds);
      } else if (!isImage && input.trim()) {
        const { predictions: preds } = await predictText(jobId, input.trim());
        setPredictions(preds);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prediction failed.");
    } finally { setLoading(false); }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setPredictions([]);
  }

  const canPredict = isImage ? !!imageFile : input.trim().length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
      <h2 className="font-bold text-slate-900 mb-1">Try your model</h2>
      <p className="text-sm text-slate-500 mb-5">
        {isImage ? "Upload an image to see what your model predicts." : "Type any text and see what your model predicts."}
      </p>

      {isImage ? (
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-violet-400 transition-colors bg-slate-50">
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            {imagePreview
              ? <img src={imagePreview} alt="preview" className="h-32 object-contain rounded-lg" />
              : <><span className="text-3xl mb-2">🖼️</span><span className="text-sm text-slate-400">Click to upload an image</span></>
            }
          </label>
        </div>
      ) : (
        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); setPredictions([]); }}
          placeholder={`Enter text to classify...\n\nExample: "${results.task_type === "text" && results.labels.includes("positive") ? "This product is absolutely amazing!" : "Breaking news: Scientists discover new species"}"`}
          rows={3}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      )}

      <div className="flex justify-between items-center mt-3">
        <button
          onClick={handlePredict}
          disabled={!canPredict || loading}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          {loading
            ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full inline-block" /> Running...</>
            : "Predict →"}
        </button>
        {loading && <p className="text-xs text-slate-400 animate-pulse">Loading model (first run may take ~30s)...</p>}
      </div>

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

      {predictions.length > 0 && (
        <div className="mt-5 space-y-2">
          {predictions.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 w-32 shrink-0 truncate">{p.label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${p.score}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-800 w-14 text-right shrink-0">{p.score}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main results page ──────────────────────────────────────────────────────

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await getJobStatus(jobId);
        if (!cancelled) {
          setJob(data);
          if (data.status === "pending" || data.status === "running") setTimeout(poll, 2000);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not reach the server.");
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [jobId]);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelTraining(jobId);
    } catch {
      // ignore; poll will reflect the final state
    }
  }

  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4">⚠️</p>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
      <p className="text-slate-500 mb-6">{error}</p>
      <Link href="/train" className="text-violet-600 hover:underline font-medium">← Try again</Link>
    </div>
  );

  if (!job) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="animate-pulse text-slate-400 text-sm">Connecting...</div>
    </div>
  );

  if (job.status === "failed") return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4">❌</p>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Training failed</h2>
      <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">{job.message}</p>
      <Link href="/train" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors inline-block">Try again</Link>
    </div>
  );

  if (job.status === "cancelled") return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4">🛑</p>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Training cancelled</h2>
      <p className="text-slate-500 mb-6 text-sm max-w-md mx-auto">You stopped this training run. No model was saved.</p>
      <Link href="/train" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors inline-block">Start a new model</Link>
    </div>
  );

  if (job.status === "completed" && job.results) {
    const r = job.results;
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">✅</p>
          <h1 className="text-3xl font-bold text-slate-900">Training Complete!</h1>
          <p className="text-slate-500 mt-2">Your model is ready.</p>
        </div>

        {/* What you built — plain-English explainer */}
        {(() => {
          const isImage = r.task_type === "image";
          const numeric = r.labels.length > 0 && r.labels.every((l) => /^\d+$/.test(String(l)));
          const inputThing = isImage ? "an image" : "a piece of text";
          return (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h2 className="font-bold text-slate-900 mb-2">📦 What you built</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                A <span className="font-semibold">{isImage ? "image" : "text"} classifier</span>. You give it {inputThing}, and it
                predicts which of these <span className="font-semibold">{r.num_labels}</span> categories it best fits:{" "}
                {r.labels.map((l, i) => (
                  <span key={i}>
                    <span className="font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{String(l)}</span>
                    {i < r.labels.length - 1 ? " " : ""}
                  </span>
                ))}
                . It learned the patterns from the <span className="font-medium">{r.dataset_id}</span> dataset
                ({r.train_samples.toLocaleString()} training examples).
              </p>
              {numeric && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                  ℹ️ This dataset labels its categories as numbers ({r.labels.join(", ")}) rather than words. They usually map to
                  real categories (e.g. 0 = negative, 1 = positive) — check the dataset&apos;s page to see what each number means.
                </p>
              )}
              <p className="text-sm text-slate-500 mt-3">
                👇 Try it below: {isImage ? "upload an image" : "type a sentence"} and hit Predict to see the model&apos;s confidence for each category.
              </p>
            </div>
          );
        })()}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-4xl font-extrabold text-violet-600">{r.accuracy}%</p>
            <p className="text-sm text-slate-500 mt-1 font-medium">Accuracy</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <p className="text-4xl font-extrabold text-violet-600">{r.f1_score}</p>
            <p className="text-sm text-slate-500 mt-1 font-medium">F1 Score</p>
          </div>
        </div>

        {/* Model details */}
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-6">
          {[
            { label: "Dataset", value: r.dataset_id },
            { label: "Task", value: r.task_type === "image" ? "Image Classification" : "Text Classification" },
            { label: "Model", value: r.model_name },
            { label: "Training samples", value: r.train_samples.toLocaleString() },
            { label: "Test samples", value: r.test_samples.toLocaleString() },
            { label: "Classes", value: `${r.num_labels} (${r.labels.join(", ")})` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between px-5 py-3 text-sm">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-medium text-slate-800 text-right max-w-xs truncate">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Try it out */}
        <TryItOut jobId={jobId} results={r} />

        {/* Download */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4 text-sm text-violet-700">
          <p className="font-semibold mb-1">What&apos;s in the download</p>
          <p className="text-violet-600">Your model files + <code className="bg-violet-100 px-1 rounded">inference.py</code> + <code className="bg-violet-100 px-1 rounded">README.md</code> with Mac &amp; Windows setup instructions.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a href={job.download_url} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-center">
            📥 Download Model + Code
          </a>
          <Link href="/train" className="flex-1 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors text-center">
            Train Another Model
          </Link>
        </div>
      </div>
    );
  }

  // Pending / running
  const pct = job.progress;
  return (
    <div className="max-w-2xl mx-auto px-4 py-20">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Training your model...</h1>
        <p className="text-slate-500 text-sm">Keep this page open. We&apos;ll update you as training progresses.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex justify-between text-sm font-medium mb-2">
          <span className="text-slate-700 animate-pulse">{job.message}</span>
          <span className="text-violet-600">{pct}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div className="bg-violet-600 h-3 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Cancel */}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="border border-red-200 hover:bg-red-50 text-red-600 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Cancel training"}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {[
          { label: "Loading dataset", threshold: 15 },
          { label: "Splitting dataset", threshold: 20 },
          { label: "Loading model & tokenizer", threshold: 35 },
          { label: "Tokenizing / preprocessing data", threshold: 45 },
          { label: "Training in progress", threshold: 86 },
          { label: "Evaluating model", threshold: 92 },
          { label: "Saving & generating code", threshold: 100 },
        ].map((s) => {
          const done = pct >= s.threshold;
          const active = !done && pct >= s.threshold - 20;
          return (
            <div key={s.label} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg">{done ? "✅" : active ? "⏳" : "⬜"}</span>
              <span className={`text-sm ${done ? "text-slate-700" : active ? "text-slate-700 font-medium animate-pulse" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
