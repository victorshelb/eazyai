"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DatasetResult, DatasetPreview } from "@/types";
import { getPopularDatasets, searchDatasets, getDatasetPreview, formatDownloads } from "@/lib/api";
import StarRating from "@/components/StarRating";

export default function ExplorePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState<DatasetResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [kaggleAvailable, setKaggleAvailable] = useState(false);

  const [selected, setSelected] = useState<DatasetResult | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewConfig, setPreviewConfig] = useState<string | null>(null);

  useEffect(() => { getPopularDatasets("text").then(setDatasets).catch(() => {}); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { getPopularDatasets("text").then(setDatasets).catch(() => {}); return; }
    setSearching(true);
    try {
      const res = await searchDatasets(q.trim(), "text");
      setDatasets(res.results);
      setKaggleAvailable(res.kaggle_available);
    } catch { setDatasets([]); } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 500);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const loadPreview = useCallback(async (ds: DatasetResult, config?: string | null) => {
    setSelected(ds);
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(true);
    const isKaggle = ds.source === "kaggle";
    try {
      const data = await getDatasetPreview(ds.id, config);
      setPreview(data);
      setPreviewConfig(data.selected_config);
    } catch (e: unknown) {
      setPreviewError(e instanceof Error ? e.message : `Could not preview this dataset${isKaggle ? " (Kaggle downloads can take a minute)" : ""}.`);
    } finally { setPreviewLoading(false); }
  }, []);

  function useDataset() {
    if (!selected) return;
    const params = new URLSearchParams({ dataset: selected.id });
    if (previewConfig) params.set("config", previewConfig);
    router.push(`/train?${params.toString()}`);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Explore Datasets</h1>
        <p className="text-slate-500 mt-1">Search, peek inside the data, and build a model from the one that fits your goal.</p>
      </div>

      {!kaggleAvailable && query.trim() && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm">
          <span>🗄️</span>
          <p className="text-slate-600 flex-1">Connect Kaggle to explore thousands more datasets.</p>
          <Link href="/settings" className="text-violet-600 font-semibold hover:underline shrink-0">Connect →</Link>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search datasets... (e.g. sentiment, news, medical, reviews)"
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
        />
        {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs animate-pulse">Searching...</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Results list */}
        <div className="lg:col-span-2 space-y-3 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2">
          {datasets.length === 0 && !searching && <p className="text-slate-400 text-sm py-8 text-center">No datasets found.</p>}
          {datasets.map((ds) => {
            const isSel = selected?.id === ds.id;
            return (
              <button
                key={ds.id}
                type="button"
                onClick={() => loadPreview(ds)}
                className={`w-full text-left p-4 rounded-xl border transition-all overflow-hidden ${
                  isSel ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-slate-900 text-sm truncate min-w-0 flex-1">{ds.id.replace("kaggle:", "")}</p>
                  {ds.source === "kaggle" && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">Kaggle</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">{ds.description}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  {ds.quality != null && <StarRating value={ds.quality} />}
                  {ds.downloads > 0 && <span>⬇ {formatDownloads(ds.downloads)}</span>}
                  {ds.likes > 0 && <span>♥ {ds.likes}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
              <p className="text-4xl mb-3">👀</p>
              <p className="font-semibold text-slate-700">Select a dataset to preview it</p>
              <p className="text-sm text-slate-400 mt-1">You&apos;ll see sample rows so you can check it fits your goal.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sticky top-24">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 break-all">{selected.id.replace("kaggle:", "")}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{selected.description}</p>
                </div>
                <button
                  onClick={useDataset}
                  className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Use this dataset →
                </button>
              </div>

              {/* Config picker */}
              {preview && preview.configs.length > 1 && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Subset</label>
                  <select
                    value={previewConfig ?? ""}
                    onChange={(e) => { setPreviewConfig(e.target.value); loadPreview(selected, e.target.value); }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {preview.configs.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {previewLoading && (
                <div className="py-12 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Loading a few sample rows...</p>
                </div>
              )}
              {previewError && <p className="text-sm text-red-500 py-4">{previewError}</p>}

              {preview && !previewLoading && (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sample rows</p>
                  <div className="overflow-x-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          {preview.columns.map((c) => (
                            <th key={c} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.rows.map((row, i) => (
                          <tr key={i} className="align-top">
                            {preview.columns.map((c) => (
                              <td key={c} className="px-3 py-2 text-slate-700 max-w-[260px]">
                                <div className="line-clamp-3">{row[c]}</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Showing {preview.rows.length} sample rows. Pick the columns and settings on the next step.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
