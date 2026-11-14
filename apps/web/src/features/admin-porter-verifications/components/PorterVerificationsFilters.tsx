import { RotateCcw, Search } from "lucide-react";
import type { FormEvent } from "react";
import { SelectField } from "../../../shared/components/SelectField";
import { PORTER_VERIFICATION_STATUS_LABELS } from "../../porter-verification/constants";
import type { PorterVerificationStatus } from "../../porter-verification/types";

const STATUS_OPTIONS = Object.entries(PORTER_VERIFICATION_STATUS_LABELS) as Array<
	[PorterVerificationStatus, string]
>;

export interface PorterVerificationsFiltersProps {
	search: string;
	status?: PorterVerificationStatus;
	disabled: boolean;
	onSearchChange: (value: string) => void;
	onStatusChange: (value?: PorterVerificationStatus) => void;
	onSubmit: () => void;
	onReset: () => void;
}

export function PorterVerificationsFilters(props: PorterVerificationsFiltersProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		props.onSubmit();
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="grid gap-3 border-b border-[#e0ebe0] p-4 lg:grid-cols-[1fr_200px_auto_auto]"
		>
			<label className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5">
				<Search className="size-4 text-[#788c7e]" />
				<span className="sr-only">Tìm kiếm người hỗ trợ</span>
				<input
					value={props.search}
					onChange={(event) => props.onSearchChange(event.target.value)}
					placeholder="Tên, email hoặc số điện thoại"
					className="w-full bg-transparent text-sm outline-none"
					maxLength={100}
				/>
			</label>
			<SelectField
				label="Lọc theo trạng thái hồ sơ"
				value={props.status ?? ""}
				disabled={props.disabled}
				onChange={(value) =>
					props.onStatusChange((value || undefined) as PorterVerificationStatus | undefined)
				}
				options={[
					{ value: "", label: "Tất cả trạng thái" },
					...STATUS_OPTIONS.map(([value, label]) => ({ value, label })),
				]}
			/>
			<button
				type="submit"
				disabled={props.disabled}
				className="rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
			>
				Tìm kiếm
			</button>
			<button
				type="button"
				onClick={props.onReset}
				disabled={props.disabled}
				className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe8df] px-4 py-2.5 text-sm font-bold text-[#425048] disabled:opacity-50"
			>
				<RotateCcw className="size-4" /> Đặt lại
			</button>
		</form>
	);
}
