"use client";

import { WizardState, PresetId } from "@/types";
import { getPresets, getDefaultCustomConfig } from "@/lib/presets";
import CustomConfig from "@/components/CustomConfig";

interface Props {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepConfig({ state, onUpdate, onNext, onBack }: Props) {
  const presets = getPresets(state.taskType);

  function selectPreset(id: PresetId) {
    const preset = presets.find((p) => p.id === id)!;
    onUpdate({
      preset: id,
      customConfig: id === "custom" ? getDefaultCustomConfig(state.taskType) : preset.config,
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">How should we train your model?</h2>
      <p className="text-slate-500 mb-6">Pick a preset to get started quickly, or choose Custom for full control.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        {presets.map((preset) => {
          const selected = state.preset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset.id)}
              className={`text-left p-5 rounded-xl border transition-all ${
                selected ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{preset.icon}</span>
                  <p className="font-bold text-slate-900">{preset.name}</p>
                </div>
                {selected && <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Selected</span>}
              </div>

              {preset.badge && (
                <span className="inline-block text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mb-2">
                  {preset.badge}
                </span>
              )}

              <p className="text-sm text-slate-500 leading-relaxed mb-3">{preset.description}</p>

              <ul className="space-y-1">
                {preset.highlights.map((h) => (
                  <li key={h} className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="text-violet-400">✓</span> {h}
                  </li>
                ))}
              </ul>

              <p className="text-xs text-slate-400 mt-3 font-medium">Estimated time: {preset.estimatedTime}</p>
            </button>
          );
        })}
      </div>

      {state.preset === "custom" && (
        <CustomConfig
          config={state.customConfig}
          taskType={state.taskType}
          onChange={(updates) => onUpdate({ customConfig: { ...state.customConfig, ...updates } })}
        />
      )}

      <div className="flex justify-between mt-6">
        <button type="button" onClick={onBack} className="text-slate-600 hover:text-slate-900 font-medium px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
          ← Back
        </button>
        <button type="button" onClick={onNext} disabled={!state.preset} className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors">
          Next: Review →
        </button>
      </div>
    </div>
  );
}
