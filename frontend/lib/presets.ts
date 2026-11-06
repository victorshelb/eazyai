import { Preset, TaskType } from "@/types";

const TEXT_PRESETS: Preset[] = [
  {
    id: "quick_start",
    name: "Quick Start",
    icon: "⚡",
    badge: "Best for beginners",
    description: "New to AI? Start here. Trains in minutes with solid results.",
    estimatedTime: "5–10 min",
    highlights: ["DistilBERT (fast & light)", "2 training epochs", "80/20 train/test split", "Up to 5,000 samples"],
    config: { modelName: "distilbert-base-uncased", numEpochs: 2, batchSize: 16, learningRate: 0.00002, testSize: 0.2, maxSamples: 5000 },
  },
  {
    id: "balanced",
    name: "Balanced",
    icon: "⚖️",
    badge: "Most popular",
    description: "The sweet spot. Good accuracy without a long wait.",
    estimatedTime: "15–25 min",
    highlights: ["DistilBERT (fast & light)", "4 training epochs", "80/20 train/test split", "Up to 10,000 samples"],
    config: { modelName: "distilbert-base-uncased", numEpochs: 4, batchSize: 16, learningRate: 0.00002, testSize: 0.2, maxSamples: 10000 },
  },
  {
    id: "high_accuracy",
    name: "High Accuracy",
    icon: "🎯",
    description: "Best results. Trains longer but worth the wait.",
    estimatedTime: "45–60 min",
    highlights: ["BERT-base (more powerful)", "8 training epochs", "85/15 train/test split", "Up to 10,000 samples"],
    config: { modelName: "bert-base-uncased", numEpochs: 8, batchSize: 8, learningRate: 0.00001, testSize: 0.15, maxSamples: 10000 },
  },
  {
    id: "custom",
    name: "Custom",
    icon: "🔧",
    description: "Know what you're doing? Take full control of every setting.",
    estimatedTime: "Varies",
    highlights: ["Your choice of model", "Your own parameters"],
    config: {},
  },
];

const IMAGE_PRESETS: Preset[] = [
  {
    id: "quick_start",
    name: "Quick Start",
    icon: "⚡",
    badge: "Best for beginners",
    description: "Fast image training to get a feel for things. Good for simple datasets.",
    estimatedTime: "20–40 min",
    highlights: ["ViT-small (fast)", "2 training epochs", "80/20 train/test split", "Up to 3,000 images"],
    config: { modelName: "WinKawaks/vit-small-patch16-224", numEpochs: 2, batchSize: 16, learningRate: 0.00002, testSize: 0.2, maxSamples: 3000 },
  },
  {
    id: "balanced",
    name: "Balanced",
    icon: "⚖️",
    badge: "Most popular",
    description: "Solid image classification results without excessive training time.",
    estimatedTime: "45–90 min",
    highlights: ["ViT-base (standard)", "3 training epochs", "80/20 train/test split", "Up to 5,000 images"],
    config: { modelName: "google/vit-base-patch16-224", numEpochs: 3, batchSize: 16, learningRate: 0.00002, testSize: 0.2, maxSamples: 5000 },
  },
  {
    id: "high_accuracy",
    name: "High Accuracy",
    icon: "🎯",
    description: "Best image classification results. Requires patience and ideally a GPU.",
    estimatedTime: "2–4 hrs",
    highlights: ["ViT-base (standard)", "5 training epochs", "85/15 train/test split", "Up to 8,000 images"],
    config: { modelName: "google/vit-base-patch16-224", numEpochs: 5, batchSize: 8, learningRate: 0.00001, testSize: 0.15, maxSamples: 8000 },
  },
  {
    id: "custom",
    name: "Custom",
    icon: "🔧",
    description: "Set every parameter yourself. Full control.",
    estimatedTime: "Varies",
    highlights: ["Your choice of model", "Your own parameters"],
    config: {},
  },
];

export function getPresets(taskType: TaskType): Preset[] {
  return taskType === "image" ? IMAGE_PRESETS : TEXT_PRESETS;
}

export function getDefaultCustomConfig(taskType: TaskType) {
  return taskType === "image"
    ? { modelName: "google/vit-base-patch16-224", numEpochs: 3, batchSize: 16, learningRate: 0.00002, testSize: 0.2, maxSamples: 5000 }
    : { modelName: "distilbert-base-uncased", numEpochs: 3, batchSize: 16, learningRate: 0.00002, testSize: 0.2, maxSamples: 10000 };
}

export const TEXT_MODEL_OPTIONS = [
  { value: "distilbert-base-uncased", label: "DistilBERT", description: "Fast and lightweight. Great starting point." },
  { value: "bert-base-uncased", label: "BERT Base", description: "More powerful. Better accuracy, slower training." },
  { value: "roberta-base", label: "RoBERTa Base", description: "Advanced. Often the most accurate of the three." },
];

export const IMAGE_MODEL_OPTIONS = [
  { value: "WinKawaks/vit-small-patch16-224", label: "ViT-small", description: "Small Vision Transformer. Fastest option." },
  { value: "google/vit-base-patch16-224", label: "ViT-base", description: "Standard Vision Transformer. Best accuracy." },
];

export const LEARNING_RATE_OPTIONS = [
  { value: 0.000001, label: "Very Low (1e-6)" },
  { value: 0.00001, label: "Low (1e-5)" },
  { value: 0.00002, label: "Standard (2e-5)" },
  { value: 0.00005, label: "High (5e-5)" },
];

export const BATCH_SIZE_OPTIONS = [
  { value: 4, label: "4 (Small — less memory)" },
  { value: 8, label: "8 (Medium)" },
  { value: 16, label: "16 (Standard)" },
  { value: 32, label: "32 (Large — needs more memory)" },
];
