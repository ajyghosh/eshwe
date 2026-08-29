"use client";

type CheckoutStep = "address" | "bag" | "pay";

const stepOrder: CheckoutStep[] = ["bag", "address", "pay"];

export function CheckoutProgress({ currentStep }: { currentStep: CheckoutStep }) {
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      {stepOrder.map((step, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;

        return (
          <div key={step} className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm ${
                active
                  ? "border-[#5e684f] bg-[#5e684f] text-[#fbf4e8]"
                  : complete
                    ? "border-[#d7ccb9] bg-[#eef1e8] text-[#4f5942]"
                    : "border-[#ddd1c0] bg-[#fffaf2] text-[#7b7b72]"
              }`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-current/10 text-xs font-semibold">
                {index + 1}
              </span>
              <span>{formatStepLabel(step)}</span>
            </div>
            {index < stepOrder.length - 1 ? <span className="text-[#c4b7a1]">→</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function formatStepLabel(step: CheckoutStep) {
  if (step === "bag") {
    return "Bag";
  }

  if (step === "address") {
    return "Address";
  }

  return "Pay";
}
