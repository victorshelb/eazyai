"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/api";

interface FullResults {
  job_id: string;
  dataset_id: string;
  task_type: string;
  model_name: string;
  preset: string;
  accuracy: number;
  f1_score: number;
  precision: number;
  recall: number;
  num_labels: number;
  labels: string[];
  train_samples: number;
  test_samples: number;
  completed_at: string;
  per_class_metrics: Record<string, { precision: number; recall: number; "f1-score": number; support: number }>;
  confusion_matrix: number[][];
  training_config: { num_epochs: number; batch_size: number; learning_rate: number; test_size: number; max_samples: number };
}

async function fetchResults(jobId: string): Promise<FullResults> {
  const token = typeof window !== "undefined" ? localStorage.getItem("eazyai_token") : null;
  const res = await fetch(`/api/training/results/${jobId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Could not load model results.");
  return res.json();
}

export default function ModelDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [results, setResults] = useState<FullResults | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchResults(jobId).then(setResults).catch((e) => setError(e.message));
  }, [jobId]);

  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <p className="text-4xl mb-4">📭</p>
      <p className="text-slate-700 font-semibold mb-2">Results not available</p>
      <p className="text-slate-500 text-sm mb-6">{error}</p>
      <p className="text-xs text-slate-400 mb-6">Detailed results are only available for models trained after this feature was added.</p>
      <Link href="/history" className="text-violet-600 hover:underline">← Back to History</Link>
    </div>
  );

  if (!results) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <div className="animate-pulse text-slate-400 text-sm">Loading model report...</div>
    </div>
  );

  const isImage = results.task_type === "image";
  const maxCm = results.confusion_matrix ? Math.max(...results.confusion_matrix.flat()) : 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/history" className="text-slate-400 hover:text-slate-600 text-sm">History</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 text-sm">{results.dataset_id}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{results.dataset_id}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            <span>{isImage ? "🖼️ Image Classification" : "📝 Text Classification"}</span>
            <span>·</span>
            <span>{formatDate(results.completed_at)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/training/download/${jobId}`}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            📥 Download
          </a>
          <Link
            href={`/results/${jobId}`}
            className="border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Try Model
          </Link>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Accuracy", value: `${results.accuracy}%`, highlight: true },
          { label: "F1 Score", value: results.f1_score.toFixed(4) },
          { label: "Precision", value: results.precision.toFixed(4) },
          { label: "Recall", value: results.recall.toFixed(4) },
        ].map((m) => (
          <div key={m.label} className={`rounded-xl p-5 text-center border ${m.highlight ? "bg-violet-50 border-violet-200" : "bg-white border-slate-200"}`}>
            <p className={`text-3xl font-extrabold ${m.highlight ? "text-violet-600" : "text-slate-800"}`}>{m.value}</p>
            <p className="text-sm text-slate-500 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Per-class metrics */}
        {Object.keys(results.per_class_metrics).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-900">Per-Class Metrics</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs">
                    <th className="text-left px-5 py-2.5 font-medium">Class</th>
                    <th className="text-right px-4 py-2.5 font-medium">Precision</th>
                    <th className="text-right px-4 py-2.5 font-medium">Recall</th>
                    <th className="text-right px-4 py-2.5 font-medium">F1</th>
                    <th className="text-right px-5 py-2.5 font-medium">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(results.per_class_metrics).map(([label, vals]) => (
                    <tr key={label} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{label}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{(vals.precision * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-slate-600">{(vals.recall * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-slate-600">{(vals["f1-score"] * 100).toFixed(1)}%</td>
                      <td className="px-5 py-3 text-right text-slate-400">{vals.support.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confusion matrix */}
        {results.confusion_matrix && results.labels.length <= 10 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-900">Confusion Matrix</p>
              <p className="text-xs text-slate-400 mt-0.5">Rows = actual, Columns = predicted</p>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="w-20" />
                    {results.labels.map((l) => (
                      <th key={l} className="px-2 py-1 text-slate-500 font-medium text-center max-w-[60px] truncate">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.confusion_matrix.map((row, i) => (
                    <tr key={i}>
                      <td className="pr-2 py-1 text-slate-500 font-medium text-right truncate max-w-[80px]">{results.labels[i]}</td>
                      {row.map((val, j) => {
                        const intensity = maxCm > 0 ? val / maxCm : 0;
                        const isDiag = i === j;
                        return (
                          <td key={j} className="px-2 py-1 text-center rounded" style={{
                            backgroundColor: isDiag
                              ? `rgba(124, 58, 237, ${0.1 + intensity * 0.75})`
                              : `rgba(239, 68, 68, ${intensity * 0.4})`,
                            color: intensity > 0.5 ? "#fff" : isDiag ? "#4c1d95" : "#991b1b",
                            fontWeight: isDiag ? 600 : 400,
                            minWidth: "48px",
                          }}>
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-3">
                Purple = correct predictions &nbsp;·&nbsp; Red = errors
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dataset & Model info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900">Dataset</p>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Source", value: results.dataset_id },
              { label: "Training samples", value: results.train_samples.toLocaleString() },
              { label: "Test samples", value: results.test_samples.toLocaleString() },
              { label: "Classes", value: String(results.num_labels) },
              { label: "Labels", value: results.labels.join(", ") },
            ].map((r) => (
              <div key={r.label} className="flex justify-between px-5 py-2.5 text-sm">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-medium text-slate-800 text-right max-w-[200px] truncate">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900">Training Config</p>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Model", value: results.model_name },
              { label: "Preset", value: results.preset.replace("_", " ") },
              { label: "Epochs", value: String(results.training_config.num_epochs) },
              { label: "Batch size", value: String(results.training_config.batch_size) },
              { label: "Learning rate", value: String(results.training_config.learning_rate) },
              { label: "Test split", value: `${Math.round(results.training_config.test_size * 100)}%` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between px-5 py-2.5 text-sm">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-medium text-slate-800 text-right max-w-[200px] truncate">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
