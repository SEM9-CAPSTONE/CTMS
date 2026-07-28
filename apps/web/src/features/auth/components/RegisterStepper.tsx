import type React from "react";
import { REGISTER_STEPS } from "../constants";

interface RegisterStepperProps {
	currentStep: number;
}

export const RegisterStepper: React.FC<RegisterStepperProps> = ({ currentStep }) => {
	return (
		<div className="relative mb-4 flex items-center justify-between">
			{/* Background Connecting Line */}
			<div className="absolute top-3.5 left-6 right-6 h-0.5 bg-[#e0ebe0] -z-0" />

			{REGISTER_STEPS.map((stepItem) => {
				const isActive = stepItem.step === currentStep;
				const isCompleted = stepItem.step < currentStep;

				return (
					<div key={stepItem.step} className="relative z-10 flex flex-col items-center gap-1">
						<div
							className={`flex h-7.5 w-7.5 items-center justify-center rounded-full text-xs font-bold transition-all ${
								isActive
									? "bg-[#164027] text-white ring-4 ring-[#164027]/15"
									: isCompleted
										? "bg-[#276143] text-white"
										: "bg-[#e8f0e9] text-[#718579]"
							}`}
						>
							{stepItem.step}
						</div>
						<span
							className={`text-[0.72rem] font-semibold ${
								isActive ? "font-bold text-[#164027]" : "text-[#718579]"
							}`}
						>
							{stepItem.label}
						</span>
					</div>
				);
			})}
		</div>
	);
};
