import { Building2, CreditCard } from "lucide-react";
import { PAYMENT_METHOD_OPTIONS } from "../schema/pay-booking.schema";

export interface PaymentMethodSelectorProps {
	selectedMethod: string;
	onChange: (method: string) => void;
	disabled?: boolean;
	fieldError?: string;
}

export function PaymentMethodSelector({
	selectedMethod,
	onChange,
	disabled = false,
	fieldError,
}: PaymentMethodSelectorProps) {
	return (
		<fieldset className="mt-3">
			<legend className="text-xs font-bold text-[#10221b]">Phương thức thanh toán</legend>
			<div className="mt-2 space-y-2">
				{PAYMENT_METHOD_OPTIONS.map((option) => {
					const isSelected = selectedMethod === option.id;
					const isOptionDisabled = disabled || option.disabled;
					const Icon = option.id === "CARD" ? CreditCard : Building2;
					return (
						<label
							key={option.id}
							className={`flex items-start gap-3 rounded-xl border p-3 transition ${
								isOptionDisabled
									? "cursor-not-allowed border-[#dfe8df] bg-[#f8faf8] opacity-50 select-none"
									: isSelected
										? "cursor-pointer border-[#164027] bg-[#f4f8f5] shadow-xs"
										: "cursor-pointer border-[#dfe8df] bg-white hover:bg-[#fafbfa]"
							}`}
						>
							<input
								type="radio"
								name="paymentMethod"
								value={option.id}
								checked={isSelected}
								disabled={isOptionDisabled}
								onChange={(e) => onChange(e.target.value)}
								className="mt-1 size-4 accent-[#164027]"
							/>
							<div className="flex-1">
								<div className="flex flex-wrap items-center gap-1.5">
									<Icon
										className={`size-4 ${isOptionDisabled ? "text-[#88998e]" : "text-[#164027]"}`}
									/>
									<span
										className={`text-xs font-extrabold ${
											isOptionDisabled ? "text-[#667a6d]" : "text-[#10221b]"
										}`}
									>
										{option.label}
									</span>
									{option.badge && (
										<span className="rounded-md bg-[#e2e8e4] px-1.5 py-0.5 text-[10px] font-semibold text-[#52665b]">
											{option.badge}
										</span>
									)}
								</div>
								<p
									className={`mt-0.5 text-[11px] ${
										isOptionDisabled ? "text-[#88998e]" : "text-[#667a6d]"
									}`}
								>
									{option.description}
								</p>
							</div>
						</label>
					);
				})}
			</div>
			{fieldError && (
				<p role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
					{fieldError}
				</p>
			)}
		</fieldset>
	);
}
