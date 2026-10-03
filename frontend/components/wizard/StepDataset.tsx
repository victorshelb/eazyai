"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DatasetResult, DatasetColumn, WizardState } from "@/types";
import { getPopularDatasets, searchDatasets, getDatasetColumns, getKaggleColumns, formatDownloads } from "@/lib/api";
import StarRating from "@/components/StarRating";
import Link from "next/link";

type DatasetTab = "search" | "upload";

interface Props {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onNext: () => void;
}

export default function StepDataset({ state, onUpdate, onNext }: Props) {
  const [activeTab, setActiveTab] = useState<DatasetTab>("search");

  // ── Search state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [datasets, setDatasets] = useState<DatasetResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [kaggleAvailable, setKaggleAvailable] = useState(false);
  const [kaggleError, setKaggleError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Column picker state ───────────────────────────────────────────────────
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [columnsError, setColumnsError] = useState("");
  const [columnsMsg, setColumnsMsg] = useState("");

  // ── Upload state ──────────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadInfo, setUploadInfo] = useState<{ filename: string; row_count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef<string | null>(null); // dataset id we've already loaded columns for

  const loadPopular = useCallback(() => {
    setHasMore(false);
    setPage(1);
    getPopularDatasets(state.taskType).then(setDatasets).catch(() => {});
  }, [state.taskType]);

  useEffect(() => { loadPopular(); }, [loadPopular]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { loadPopular(); return; }
    setSearching(true);
    setKaggleError("");
    setPage(1);
    try {
      const res = await searchDatasets(q.trim(), state.taskType, 1);
      setDatasets(res.results);
      setKaggleAvailable(res.kaggle_available);
      setHasMore(res.has_more);
      if (res.kaggle_error) setKaggleError(res.kaggle_error);
    } catch { setDatasets([]); setHasMore(false); } finally { setSearching(false); }
  }, [state.taskType, loadPopular]);

  const loadMore = useCallback(async () => {
    if (!query.trim() || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await searchDatasets(query.trim(), state.taskType, nextPage);
      // De-duplicate by id when merging pages
      setDatasets((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        const fresh = res.results.filter((d) => !seen.has(d.id));
        return [...prev, ...fresh];
      });
      setPage(nextPage);
      setHasMore(res.has_more);
    } catch { setHasMore(false); } finally { setLoadingMore(false); }
  }, [query, page, state.taskType, loadingMore]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 500);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  function applyColumns(cols: DatasetColumn[], ds: DatasetResult, extra: Partial<WizardState>) {
    setColumns(cols);
    const textCol = cols.find((c) => c.type === "text")?.name ?? cols[0]?.name ?? "";
    const labelCol = cols.find((c) => c.type === "label")?.name ?? cols[1]?.name ?? "";
    onUpdate({ dataset: ds, textColumn: textCol, labelColumn: labelCol, ...extra });
  }

  async function doLoadColumns(ds: DatasetResult, configName?: string | null) {
    setColumns([]);
    setColumnsError("");
    setLoadingColumns(true);
    const isKaggle = ds.source === "kaggle";
    setColumnsMsg(isKaggle ? "Downloading dataset to read columns (may take a minute)..." : configName ? `Loading the "${configName}" subset...` : "Loading column names...");
    try {
      if (isKaggle) {
        const ref = ds.id.replace("kaggle:", "");
        const result = await getKaggleColumns(ref);
        applyColumns(result.columns, ds, { configs: [], configName: null });
      } else {
        const result = await getDatasetColumns(ds.id, configName ?? undefined);
        applyColumns(result.columns, ds, { configs: result.configs, configName: result.selected_config });
      }
    } catch (e: unknown) {
      setColumnsError(e instanceof Error ? e.message : "Could not load columns.");
    } finally { setLoadingColumns(false); }
  }

  // Auto-load columns whenever the selected dataset changes — covers both card
  // clicks and arriving from the Explore page via ?dataset=... in the URL.
  useEffect(() => {
    const ds = state.dataset;
    if (!ds) { loadedRef.current = null; return; }
    if (loadedRef.current === ds.id) return;        // already handled (e.g. upload)
    loadedRef.current = ds.id;
    doLoadColumns(ds, state.configName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dataset?.id]);

  function selectDataset(ds: DatasetResult) {
    // Reset; the effect above loads the columns.
    onUpdate({ dataset: ds, textColumn: "", labelColumn: "", configs: [], configName: null });
  }

  async function changeConfig(configName: string) {
    if (!state.dataset) return;
    onUpdate({ configName });
    await doLoadColumns(state.dataset, configName);
  }

  async function handleFileUpload(file: File) {
    setUploadFile(file);
    setUploading(true);
    setUploadError("");
    setColumns([]);
    onUpdate({ dataset: null, textColumn: "", labelColumn: "" });

    const form = new FormData();
    form.append("file", file);
    const token = typeof window !== "undefined" ? localStorage.getItem("eazyai_token") : null;

    try {
      const res = await fetch("/api/datasets/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Upload failed.");
      }
      const data = await res.json();
      const fakeDataset: DatasetResult = {
        id: data.dataset_id,
        description: `Uploaded file: ${data.filename} (${data.row_count.toLocaleString()} rows)`,
        downloads: 0,
        likes: 0,
        tags: ["uploaded"],
        source: "huggingface",
      };
      // Mark as already-loaded so the auto-load effect doesn't try to re-fetch
      // columns for an "upload:" id (which isn't a real HF dataset).
      loadedRef.current = data.dataset_id;
      setColumns(data.columns);
      setUploadInfo({ filename: data.filename, row_count: data.row_count });
      const textCol = data.columns[0]?.name ?? "";
      const labelCol = data.columns[1]?.name ?? "";
      onUpdate({ dataset: fakeDataset, textColumn: textCol, labelColumn: labelCol, configs: [], configName: null });
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
      setUploadFile(null);
    } finally { setUploading(false); }
  }

  const isImage = state.taskType === "image";
  const textColLabel = isImage ? "Image column" : "Text column";
  const textColHint = isImage ? "(the images to classify)" : "(the input text)";
  const canProceed = state.dataset !== null && state.textColumn !== "" && state.labelColumn !== "" && state.textColumn !== state.labelColumn;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Choose a dataset</h2>
      <p className="text-slate-500 mb-5">Search HuggingFace or Kaggle, or upload your own CSV file.</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {([["search", "🔍 Search Datasets"], ["upload", "⬆️ Upload File"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px border-b-2 transition-colors ${
              activeTab === id ? "border-violet-600 text-violet-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "search" && (
        <>
          {/* Kaggle verification error */}
          {kaggleError && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm">
              <span className="text-amber-500 text-lg shrink-0">⚠️</span>
              <p className="text-amber-700">{kaggleError}</p>
            </div>
          )}

          {/* Kaggle not connected banner */}
          {!kaggleAvailable && query.trim() && !kaggleError && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm">
              <span>🗄️</span>
              <p className="text-slate-600 flex-1">Connect Kaggle to search thousands more datasets.</p>
              <Link href="/settings" className="text-violet-600 font-semibold hover:underline shrink-0">Connect →</Link>
            </div>
          )}

          {/* Search input */}
          <div className="relative mb-5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isImage ? "Search datasets... (e.g. cifar, food, animals)" : "Search datasets... (e.g. sentiment, news, spam)"}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            />
            {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs animate-pulse">Searching...</span>}
          </div>

          {/* Dataset grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {datasets.length === 0 && !searching && (
              <p className="text-slate-400 text-sm col-span-2 py-8 text-center">No results found.</p>
            )}
            {datasets.map((ds) => {
              const selected = state.dataset?.id === ds.id;
              const isKaggle = ds.source === "kaggle";
              return (
                <button
                  key={ds.id}
                  type="button"
                  onClick={() => selectDataset(ds)}
                  className={`text-left p-4 rounded-xl border transition-all overflow-hidden ${
                    selected ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-slate-900 text-sm truncate min-w-0 flex-1">{ds.id.replace("kaggle:", "")}</p>
                    <div className="flex gap-1 shrink-0">
                      {isKaggle && <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Kaggle</span>}
                      {selected && <span className="text-xs font-medium text-violet-600">✓</span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">{ds.description}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 overflow-hidden">
                    {ds.quality != null && <span className="shrink-0"><StarRating value={ds.quality} /></span>}
                    {ds.downloads > 0 && <span className="shrink-0">⬇ {formatDownloads(ds.downloads)}</span>}
                    {ds.likes > 0 && <span className="shrink-0">♥ {ds.likes}</span>}
                    {ds.tags.slice(0, 1).map((t) => (
                      <span key={t} className="bg-slate-100 px-2 py-0.5 rounded-full max-w-[130px] truncate shrink-0">{t}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && query.trim() && (
            <div className="flex justify-center mb-5">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="border border-slate-200 hover:border-violet-400 text-slate-600 hover:text-violet-600 font-medium text-sm px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore
                  ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full inline-block" /> Loading...</>
                  : "Load more datasets"}
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === "upload" && (
        <div className="mb-5">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              uploading ? "border-violet-300 bg-violet-50" : "border-slate-200 hover:border-violet-400 hover:bg-slate-50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
            />
            {uploading ? (
              <><div className="animate-spin w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full mx-auto mb-3" /><p className="text-sm text-violet-600 font-medium">Uploading and reading file...</p></>
            ) : uploadInfo ? (
              <><p className="text-3xl mb-2">✅</p><p className="font-semibold text-slate-900">{uploadInfo.filename}</p><p className="text-sm text-slate-500">{uploadInfo.row_count.toLocaleString()} rows detected</p><p className="text-xs text-violet-500 mt-2">Click to upload a different file</p></>
            ) : (
              <><p className="text-4xl mb-3">📂</p><p className="font-semibold text-slate-900 mb-1">Drop your CSV file here</p><p className="text-sm text-slate-500 mb-3">or click to browse</p><p className="text-xs text-slate-400">Supports .csv and .tsv files</p></>
            )}
          </div>
          {uploadError && <p className="text-sm text-red-500 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>}
          {!uploadInfo && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              <p className="font-medium mb-1">File requirements</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 text-xs">
                <li>CSV or TSV format with headers in the first row</li>
                <li>Must have a text column and a label/category column</li>
                <li>Example: columns named <code className="bg-slate-100 px-1 rounded">text</code> and <code className="bg-slate-100 px-1 rounded">label</code></li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Column picker — shown for both search and upload */}
      {state.dataset && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <p className="font-semibold text-slate-800 mb-3">
            Configure columns for <span className="text-violet-600">{state.dataset.id.startsWith("upload:") ? uploadInfo?.filename : state.dataset.id.replace("kaggle:", "")}</span>
          </p>

          {/* Subset / config picker — only for HF datasets that ship multiple configs */}
          {state.configs && state.configs.length > 1 && (
            <div className="mb-4 bg-violet-50 border border-violet-100 rounded-lg p-3">
              <label className="block text-sm font-medium text-violet-800 mb-1">
                This dataset has multiple subsets <span className="text-xs font-normal text-violet-500">— pick which one to train on</span>
              </label>
              <select
                value={state.configName ?? ""}
                onChange={(e) => changeConfig(e.target.value)}
                disabled={loadingColumns}
                className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {state.configs.map((cfg) => <option key={cfg} value={cfg}>{cfg}</option>)}
              </select>
            </div>
          )}

          {loadingColumns && <p className="text-sm text-slate-400 animate-pulse">{columnsMsg}</p>}
          {columnsError && <p className="text-sm text-red-500">{columnsError}</p>}
          {!loadingColumns && !columnsError && columns.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {textColLabel} <span className="text-xs text-slate-400">{textColHint}</span>
                </label>
                <select value={state.textColumn} onChange={(e) => onUpdate({ textColumn: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Select a column...</option>
                  {columns.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Label column <span className="text-xs text-slate-400">(the category/class)</span>
                </label>
                <select value={state.labelColumn} onChange={(e) => onUpdate({ labelColumn: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Select a column...</option>
                  {columns.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {isImage && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-5">
          ⚠️ Image classification is significantly slower on CPU. Training may take 1–4 hours without a GPU.
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onNext} disabled={!canProceed}
          className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
          Next: Configure →
        </button>
      </div>
    </div>
  );
}
