"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardState } from "@/types";
import { getPresets, TEXT_MODEL_OPTIONS, IMAGE_MODEL_OPTIONS } from "@/lib/presets";
import { startTraining } from "@/lib/api";

interface Props {
  state: WizardState;
  onBack: () => void;
}

export default function StepReview({ state, onBack }: Props) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const presets = getPresets(state.taskType);
  const preset = presets.find((p) => p.id === state.preset)!;
  const cfg = state.customConfig;
  const modelOptions = state.taskType === "image" ? IMAGE_MODEL_OPTIONS : TEXT_MODEL_OPTIONS;

  const modelLabel =
    modelOptions.find((m) => m.value === cfg.modelName)?.label ?? cfg.modelName ?? "—";
  const testPct = Math.round((cfg.testSize ?? 0.2) * 100);

  async function handleTrain() {
    if (!state.dataset || !state.textColumn || !state.labelColumn) return;
    setStarting(true);
    setError("");
    try {
      const { job_id } = await startTraining({
        datasetId: state.dataset.id,
        textColumn: state.textColumn,
        labelColumn: state.labelColumn,
        modelName: cfg.modelName ?? "distilbert-base-uncased",
        numEpochs: cfg.numEpochs ?? 3,
        batchSize: cfg.batchSize ?? 16,
        learningRate: cfg.learningRate ?? 0.00002,
        testSize: cfg.testSize ?? 0.2,
        maxSamples: cfg.maxSamples ?? 10000,
        preset: state.preset,
        taskType: state.taskType,
        configName: state.configName ?? null,
      });
      router.push(`/results/${job_id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start training. Is the backend running?";
      setError(msg);
      setStarting(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Review & Train</h2>
      <p className="text-slate-500 mb-6">Everything looks good? Hit the button below to start training.</p>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-6">
        {/* Dataset */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Dataset</p>
          <p className="font-semibold text-slate-900">{state.dataset?.id?.replace("kaggle:", "").replace(/^upload:[a-z0-9]+_/, "")}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            Text: <span className="font-medium text-slate-700">{state.textColumn}</span>
            &nbsp;&nbsp;Label: <span className="font-medium text-slate-700">{state.labelColumn}</span>
            {state.configName && <>&nbsp;&nbsp;Subset: <span className="font-medium text-slate-700">{state.configName}</span></>}
          </p>
        </div>

        {/* Config */}
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Configuration</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{preset.icon}</span>
            <p className="font-semibold text-slate-900">{preset.name}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Model", value: modelLabel },
              { label: "Epochs", value: String(cfg.numEpochs ?? "—") },
              { label: "Batch size", value: String(cfg.batchSize ?? "—") },
              { label: "Train split", value: `${100 - testPct}%` },
              { label: "Test split", value: `${testPct}%` },
              { label: "Max samples", value: (cfg.maxSamples ?? 10000).toLocaleString() },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="text-sm font-semibold text-slate-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Time estimate */}
        <div className="px-5 py-4 flex items-center gap-2">
          <span className="text-lg">⏱</span>
          <p className="text-sm text-slate-600">
            Estimated training time: <span className="font-semibold text-slate-800">{preset.estimatedTime}</span>
          </p>
        </div>
      </div>

      {/* Large-dataset notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 mb-6 flex items-start gap-2">
        <span className="text-base shrink-0">ℹ️</span>
        <p>
          For speed, EazyAI trains on up to <span className="font-semibold">{(cfg.maxSamples ?? 10000).toLocaleString()}</span> rows.
          If this dataset is larger, only the first {(cfg.maxSamples ?? 10000).toLocaleString()} rows are used — you can raise this in the{" "}
          <span className="font-medium">Custom</span> preset.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={starting}
          className="text-slate-600 hover:text-slate-900 font-medium px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          &larr; Back
        </button>
        <button
          type="button"
          onClick={handleTrain}
          disabled={starting}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          {starting ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Starting...
            </>
          ) : (
            "🚀 Start Training"
          )}
        </button>
      </div>
    </div>
  );
}
