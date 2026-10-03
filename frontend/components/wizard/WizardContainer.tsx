"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { WizardState, TaskType } from "@/types";
import { TEMPLATES } from "@/lib/templates";
import StepDataset from "./StepDataset";
import StepConfig from "./StepConfig";
import StepReview from "./StepReview";

const STEP_LABELS = ["Choose Dataset", "Configure", "Review & Train"];

function buildInitialState(taskType: TaskType): WizardState {
  return {
    taskType,
    dataset: null,
    textColumn: "",
    labelColumn: "",
    preset: "balanced",
    customConfig: {
      modelName: taskType === "image" ? "google/vit-base-patch16-224" : "distilbert-base-uncased",
      numEpochs: taskType === "image" ? 3 : 4,
      batchSize: 16,
      learningRate: 0.00002,
      testSize: 0.2,
      maxSamples: taskType === "image" ? 5000 : 10000,
    },
  };
}

export default function WizardContainer() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(buildInitialState("text"));

  useEffect(() => {
    const key = searchParams.get("template");
    if (key && TEMPLATES[key]) {
      setState(TEMPLATES[key].initialState);
      setStep(2);
      return;
    }
    // Arriving from the Explore page with a pre-chosen dataset.
    const datasetId = searchParams.get("dataset");
    if (datasetId) {
      const isKaggle = datasetId.startsWith("kaggle:");
      setState({
        ...buildInitialState("text"),
        dataset: {
          id: datasetId,
          description: "",
          downloads: 0,
          likes: 0,
          tags: [],
          source: isKaggle ? "kaggle" : "huggingface",
        },
        configName: searchParams.get("config"),
      });
      setStep(0);
    }
  }, [searchParams]);

  function update(updates: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  function switchTaskType(t: TaskType) {
    setState(buildInitialState(t));
    setStep(0);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Task type selector */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {(["text", "image"] as TaskType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTaskType(t)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              state.taskType === t
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span>{t === "text" ? "📝" : "🖼️"}</span>
            {t === "text" ? "Text Classification" : "Image Classification"}
          </button>
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step ? "bg-violet-600 text-white" : i === step ? "bg-violet-600 text-white ring-4 ring-violet-100" : "bg-slate-200 text-slate-400"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`mt-1.5 text-xs font-medium whitespace-nowrap ${i === step ? "text-violet-600" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-16 sm:w-20 h-0.5 mx-2 mb-5 transition-colors ${i < step ? "bg-violet-600" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {step === 0 && <StepDataset state={state} onUpdate={update} onNext={() => setStep(1)} />}
        {step === 1 && <StepConfig state={state} onUpdate={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <StepReview state={state} onBack={() => setStep(1)} />}
      </div>
    </div>
  );
}
