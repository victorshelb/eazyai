"use client";

import { TrainingConfig, TaskType } from "@/types";
import { TEXT_MODEL_OPTIONS, IMAGE_MODEL_OPTIONS, LEARNING_RATE_OPTIONS, BATCH_SIZE_OPTIONS } from "@/lib/presets";

interface Props {
  config: Partial<TrainingConfig>;
  taskType: TaskType;
  onChange: (updates: Partial<TrainingConfig>) => void;
}

export default function CustomConfig({ config, taskType, onChange }: Props) {
  const modelOptions = taskType === "image" ? IMAGE_MODEL_OPTIONS : TEXT_MODEL_OPTIONS;

  return (
    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-6">
      <p className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Custom Settings</p>

      {/* Model */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Base model</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {modelOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ modelName: opt.value })}
              className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                config.modelName === opt.value ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <p className="font-semibold">{opt.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Epochs */}
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Training epochs</label>
          <span className="text-sm font-semibold text-violet-600">{config.numEpochs ?? 3}</span>
        </div>
        <input type="range" min={1} max={15} value={config.numEpochs ?? 3} onChange={(e) => onChange({ numEpochs: Number(e.target.value) })} className="w-full accent-violet-600" />
        <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1 (faster)</span><span>15 (better accuracy)</span></div>
      </div>

      {/* Train/test split */}
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Test split</label>
          <span className="text-sm font-semibold text-violet-600">
            {Math.round((config.testSize ?? 0.2) * 100)}% test / {100 - Math.round((config.testSize ?? 0.2) * 100)}% train
          </span>
        </div>
        <input type="range" min={10} max={40} step={5} value={Math.round((config.testSize ?? 0.2) * 100)} onChange={(e) => onChange({ testSize: Number(e.target.value) / 100 })} className="w-full accent-violet-600" />
        <div className="flex justify-between text-xs text-slate-400 mt-1"><span>10% test</span><span>40% test</span></div>
      </div>

      {/* Max samples */}
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Max {taskType === "image" ? "images" : "samples"}</label>
          <span className="text-sm font-semibold text-violet-600">{(config.maxSamples ?? 10000).toLocaleString()}</span>
        </div>
        <input type="range" min={500} max={taskType === "image" ? 10000 : 50000} step={500} value={config.maxSamples ?? 10000} onChange={(e) => onChange({ maxSamples: Number(e.target.value) })} className="w-full accent-violet-600" />
        <div className="flex justify-between text-xs text-slate-400 mt-1"><span>500 (quick test)</span><span>{taskType === "image" ? "10,000" : "50,000"}</span></div>
      </div>

      {/* Batch size */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Batch size</label>
        <select value={config.batchSize ?? 16} onChange={(e) => onChange({ batchSize: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
          {BATCH_SIZE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Learning rate */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Learning rate</label>
        <select value={config.learningRate ?? 0.00002} onChange={(e) => onChange({ learningRate: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
          {LEARNING_RATE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <p className="text-xs text-slate-400 mt-1">Standard (2e-5) works well for most cases.</p>
      </div>
    </div>
  );
}
