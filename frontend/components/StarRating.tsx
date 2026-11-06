"use client";

/** Renders a 1–5 quality rating as stars with the numeric value. */
export default function StarRating({ value, showNumber = true }: { value?: number; showNumber?: boolean }) {
  if (value == null) return null;
  const full = Math.round(value); // nearest whole star for clean rendering

  // Colour by tier: green (great), amber (ok), slate (low)
  const color = value >= 4 ? "text-emerald-500" : value >= 2.8 ? "text-amber-500" : "text-slate-400";

  return (
    <span className={`inline-flex items-center gap-1 ${color}`} title={`Quality score: ${value} / 5 (based on community likes, popularity & documentation)`}>
      <span className="text-xs leading-none">
        {"★".repeat(full)}
        <span className="text-slate-300">{"★".repeat(Math.max(0, 5 - full))}</span>
      </span>
      {showNumber && <span className="text-xs font-semibold">{value.toFixed(1)}</span>}
    </span>
  );
}
