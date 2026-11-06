import { Suspense } from "react";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
