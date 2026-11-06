export type TaskType = "text" | "image";
export type PresetId = "quick_start" | "balanced" | "high_accuracy" | "custom";

export interface DatasetResult {
  id: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  source: "huggingface" | "kaggle";
  quality?: number;
}

export interface DatasetColumn {
  name: string;
  type: "text" | "label" | "number" | "other";
}

export interface DatasetColumnsResponse {
  columns: DatasetColumn[];
  configs: string[];
  selected_config: string | null;
}

export interface DatasetPreview {
  columns: string[];
  rows: Record<string, string>[];
  configs: string[];
  selected_config: string | null;
}

export interface TrainingConfig {
  datasetId: string;
  textColumn: string;
  labelColumn: string;
  modelName: string;
  numEpochs: number;
  batchSize: number;
  learningRate: number;
  testSize: number;
  maxSamples: number;
  preset: PresetId;
  taskType: TaskType;
  configName?: string | null;
}

export interface Preset {
  id: PresetId;
  name: string;
  icon: string;
  badge?: string;
  description: string;
  estimatedTime: string;
  highlights: string[];
  config: Partial<Omit<TrainingConfig, "datasetId" | "textColumn" | "labelColumn" | "preset" | "taskType">>;
}

export interface TrainingResults {
  accuracy: number;
  f1_score: number;
  num_labels: number;
  labels: string[];
  train_samples: number;
  test_samples: number;
  model_name: string;
  dataset_id: string;
  task_type: TaskType;
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  message: string;
  results?: TrainingResults;
  download_url?: string;
}

export interface HistoryEntry {
  job_id: string;
  dataset_id: string;
  task_type: TaskType;
  model_name: string;
  preset: string;
  accuracy: number;
  f1_score: number;
  completed_at: string;
  download_url: string;
  train_samples?: number;
}

export interface WizardState {
  taskType: TaskType;
  dataset: DatasetResult | null;
  textColumn: string;
  labelColumn: string;
  preset: PresetId;
  customConfig: Partial<TrainingConfig>;
  configName?: string | null;
  configs?: string[];
}

export interface KaggleStatus {
  connected: boolean;
  username?: string;
}
