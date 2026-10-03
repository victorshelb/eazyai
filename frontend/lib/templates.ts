import { WizardState } from "@/types";

interface Template {
  name: string;
  description: string;
  emoji: string;
  detail: string;
  quality: number;
  initialState: WizardState;
}

const make = (id: string, textCol: string, labelCol: string, preset: WizardState["preset"], maxSamples: number, desc: string): WizardState => ({
  taskType: "text",
  dataset: {
    id,
    description: desc,
    downloads: 0,
    likes: 0,
    tags: [],
    source: "huggingface",
  },
  textColumn: textCol,
  labelColumn: labelCol,
  preset,
  customConfig: {
    modelName: "distilbert-base-uncased",
    numEpochs: preset === "balanced" ? 4 : 2,
    batchSize: 16,
    learningRate: 0.00002,
    testSize: 0.2,
    maxSamples,
  },
});

export const TEMPLATES: Record<string, Template> = {
  sentiment: {
    name: "Sentiment Analysis",
    description: "Is a review positive or negative?",
    detail: "IMDB movie reviews · 2 classes · ~5 min",
    emoji: "😊",
    quality: 4.8,
    initialState: make("imdb", "text", "label", "quick_start", 5000, "IMDB movie reviews labeled positive or negative."),
  },
  spam: {
    name: "Spam Detection",
    description: "Filter spam messages automatically.",
    detail: "SMS Spam dataset · 2 classes · ~5 min",
    emoji: "🚫",
    quality: 4.5,
    initialState: make("sms_spam", "sms", "label", "quick_start", 5000, "SMS messages labeled spam or ham."),
  },
  emotion: {
    name: "Emotion Recognition",
    description: "Detect joy, anger, sadness, and more.",
    detail: "Twitter Emotion · 6 classes · ~15 min",
    emoji: "🎭",
    quality: 4.7,
    initialState: make("dair-ai/emotion", "text", "label", "balanced", 10000, "Twitter messages labeled with 6 emotions."),
  },
  news: {
    name: "News Categorisation",
    description: "Sort articles into topics automatically.",
    detail: "AG News · 4 classes · ~5 min",
    emoji: "📰",
    quality: 4.7,
    initialState: make("ag_news", "text", "label", "quick_start", 5000, "News articles in 4 categories."),
  },
};
