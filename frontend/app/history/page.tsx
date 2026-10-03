"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HistoryEntry } from "@/types";
import { getTrainingHistory, formatDate } from "@/lib/api";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrainingHistory()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <p className="text-slate-400 text-sm animate-pulse">Loading history...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Training History</h1>
          <p className="text-slate-500 mt-1">All your trained models. Click any row to see the full report.</p>
        </div>
        <Link
          href="/train"
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Train New Model
        </Link>
      </div>

      {history.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-slate-700 font-semibold mb-1">No models trained yet</p>
          <p className="text-slate-400 text-sm mb-6">Your trained models will appear here after your first training run.</p>
          <Link href="/train" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors inline-block">
            Train Your First Model
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <Link
              key={entry.job_id}
              href={`/history/${entry.job_id}`}
              className="group bg-white border border-slate-200 hover:border-violet-300 hover:shadow-sm rounded-xl p-5 flex items-center gap-4 transition-all"
            >
              <span className="text-2xl">{entry.task_type === "image" ? "🖼️" : "📝"}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-slate-900 truncate group-hover:text-violet-600 transition-colors">
                    {entry.dataset_id}
                  </p>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                    {entry.task_type === "image" ? "Image" : "Text"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 truncate">
                  {entry.model_name} · {entry.preset.replace("_", " ")} · {formatDate(entry.completed_at)}
                </p>
              </div>

              <div className="text-center shrink-0">
                <p className="text-xl font-extrabold text-violet-600">{entry.accuracy}%</p>
                <p className="text-xs text-slate-400">accuracy</p>
              </div>

              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-medium text-slate-700">F1: {entry.f1_score}</p>
                <p className="text-xs text-slate-400 mt-0.5">{entry.train_samples?.toLocaleString() ?? "—"} samples</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={entry.download_url}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-3 py-2 rounded-lg transition-colors"
                  title="Download model"
                >
                  📥
                </a>
                <span className="text-slate-300 text-lg">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
