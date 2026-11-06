import { Suspense } from "react";
import WizardContainer from "@/components/wizard/WizardContainer";

export default function TrainPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading...</div>}>
      <WizardContainer />
    </Suspense>
  );
}
