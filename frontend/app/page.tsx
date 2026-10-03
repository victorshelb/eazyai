import Link from "next/link";
import { TEMPLATES } from "@/lib/templates";
import StarRating from "@/components/StarRating";

const features = [
  { icon: "🔍", title: "Search Datasets", body: "Browse millions of datasets from HuggingFace and Kaggle. Find the right data in seconds." },
  { icon: "⚙️", title: "Pick a Config", body: "Choose from beginner-friendly presets or go fully custom. No ML knowledge required." },
  { icon: "📦", title: "Download Your Model", body: "Get a trained model file plus ready-to-run code. Works with Python, VS Code, and more." },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <span className="inline-block bg-violet-100 text-violet-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          No coding required
        </span>
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-6">
          Build AI models<br />
          <span className="text-violet-600">without writing a single line of code.</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10">
          Search for a dataset, pick your settings, and EazyAI trains a custom model for you.
          Download it and run it anywhere.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/train" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8 py-3 rounded-xl text-lg transition-colors">
            Start Building &rarr;
          </Link>
          <a href="#examples" className="text-slate-600 hover:text-slate-900 font-medium px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
            See examples
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="text-center p-6">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick-start templates */}
      <section id="examples" className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Start in one click</h2>
          <p className="text-slate-500">Pick a template and we&apos;ll pre-configure everything — dataset, model, and settings.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(TEMPLATES).map(([key, tpl]) => (
            <Link
              key={key}
              href={`/train?template=${key}`}
              className="group bg-white border border-slate-200 hover:border-violet-400 hover:shadow-md rounded-xl p-5 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-3xl">{tpl.emoji}</p>
                <span className="bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5"><StarRating value={tpl.quality} /></span>
              </div>
              <p className="font-semibold text-slate-900 mb-1 group-hover:text-violet-600 transition-colors">
                {tpl.name}
              </p>
              <p className="text-sm text-slate-500 mb-3">{tpl.description}</p>
              <p className="text-xs text-slate-400">{tpl.detail}</p>
              <p className="text-xs font-medium text-violet-500 mt-3 group-hover:underline">
                Use this template &rarr;
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-violet-600 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to train your first model?</h2>
          <p className="text-violet-200 mb-8">It takes less than 5 minutes to get started.</p>
          <Link href="/train" className="bg-white text-violet-600 hover:bg-violet-50 font-semibold px-8 py-3 rounded-xl text-lg transition-colors inline-block">
            Start Building &rarr;
          </Link>
        </div>
      </section>

      <footer className="text-center py-8 text-sm text-slate-400">
        EazyAI &mdash; Powered by HuggingFace Transformers
      </footer>
    </main>
  );
}
