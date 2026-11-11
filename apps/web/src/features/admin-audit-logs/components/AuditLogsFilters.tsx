import { RotateCcw } from "lucide-react";
import type { FormEvent } from "react";
import { ACTION_LABELS, OUTCOME_OPTIONS, TARGET_TYPE_LABELS } from "../constants";

export interface AuditLogsFiltersProps {
	actor: string;
	action: string;
	targetType: string;
	outcome: "success" | "failure" | "";
	startDate: string;
	endDate: string;
	disabled: boolean;
	onActorChange: (value: string) => void;
	onActionChange: (value: string) => void;
	onTargetTypeChange: (value: string) => void;
	onOutcomeChange: (value: "success" | "failure" | "") => void;
	onStartDateChange: (value: string) => void;
	onEndDateChange: (value: string) => void;
	onSubmit: () => void;
	onReset: () => void;
}

export function AuditLogsFilters(props: AuditLogsFiltersProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		props.onSubmit();
	};

	return (
		<form onSubmit={handleSubmit} className="border-b border-[#e0ebe0] p-5 space-y-4 bg-white">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-actor"
						className="text-xs font-bold text-[#425048] uppercase tracking-wide"
					>
						Người thực hiện
					</label>
					<input
						id="filter-actor"
						value={props.actor}
						onChange={(e) => props.onActorChange(e.target.value)}
						placeholder="Tìm theo tên, email..."
						className="rounded-xl border border-[#dfe8df] px-3.5 py-2.5 text-sm bg-white outline-none focus:border-[#164027]"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-action"
						className="text-xs font-bold text-[#425048] uppercase tracking-wide"
					>
						Hành động
					</label>
					<select
						id="filter-action"
						value={props.action}
						onChange={(e) => props.onActionChange(e.target.value)}
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					>
						<option value="">Tất cả hành động</option>
						{Object.entries(ACTION_LABELS).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-target-type"
						className="text-xs font-bold text-[#425048] uppercase tracking-wide"
					>
						Loại đối tượng
					</label>
					<select
						id="filter-target-type"
						value={props.targetType}
						onChange={(e) => props.onTargetTypeChange(e.target.value)}
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					>
						<option value="">Tất cả loại</option>
						{Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="filter-outcome"
						className="text-xs font-bold text-[#425048] uppercase tracking-wide"
					>
						Kết quả (Outcome)
					</label>
					<select
						id="filter-outcome"
						value={props.outcome}
						onChange={(e) => props.onOutcomeChange(e.target.value as "success" | "failure" | "")}
						className="rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164027]"
					>
						<option value="">Tất cả kết quả</option>
						{OUTCOME_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="filter-start-date"
							className="text-xs font-bold text-[#425048] uppercase tracking-wide"
						>
							Từ ngày
						</label>
						<input
							id="filter-start-date"
							type="date"
							value={props.startDate}
							onChange={(e) => props.onStartDateChange(e.target.value)}
							className="rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm bg-white outline-none focus:border-[#164027]"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="filter-end-date"
							className="text-xs font-bold text-[#425048] uppercase tracking-wide"
						>
							Đến ngày
						</label>
						<input
							id="filter-end-date"
							type="date"
							value={props.endDate}
							onChange={(e) => props.onEndDateChange(e.target.value)}
							className="rounded-xl border border-[#dfe8df] px-3.5 py-2 text-sm bg-white outline-none focus:border-[#164027]"
						/>
					</div>
				</div>
			</div>

			<div className="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onClick={props.onReset}
					disabled={props.disabled}
					className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe8df] px-5 py-2.5 text-sm font-bold text-[#425048] hover:bg-[#f1f5f0] transition disabled:opacity-50"
				>
					<RotateCcw className="size-4" /> Đặt lại
				</button>
				<button
					type="submit"
					disabled={props.disabled}
					className="rounded-xl bg-[#164027] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0f2d1b] transition disabled:opacity-50"
				>
					Tìm kiếm
				</button>
			</div>
		</form>
	);
}
