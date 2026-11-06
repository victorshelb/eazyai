"use client";

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number (0–9)", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character (!@#$%...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordValid(password: string): boolean {
  return RULES.every((r) => r.test(password));
}

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.label} className={`flex items-center gap-2 text-xs font-medium ${met ? "text-emerald-600" : "text-red-500"}`}>
            <span className="text-base leading-none">{met ? "✓" : "✗"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
