import { RotateCcw, Search } from "lucide-react";
import type { FormEvent } from "react";
import { USER_ROLE_OPTIONS, USER_STATUS_OPTIONS } from "../constants";
import type { UserRole, UserStatus } from "../types";

export interface UserAccountsFiltersProps {
	search: string;
	role?: UserRole;
	status?: UserStatus;
	disabled: boolean;
	onSearchChange: (value: string) => void;
	onRoleChange: (value?: UserRole) => void;
	onStatusChange: (value?: UserStatus) => void;
	onSubmit: () => void;
	onReset: () => void;
}

export function UserAccountsFilters(props: UserAccountsFiltersProps) {
	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		props.onSubmit();
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="grid gap-3 border-b border-[#e0ebe0] p-4 lg:grid-cols-[1fr_180px_190px_auto_auto]"
		>
			<label className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5">
				<Search className="size-4 text-[#788c7e]" />
				<span className="sr-only">Tìm kiếm tài khoản</span>
				<input
					value={props.search}
					onChange={(event) => props.onSearchChange(event.target.value)}
					placeholder="Tên, email hoặc số điện thoại"
					className="w-full bg-transparent text-sm outline-none"
					maxLength={100}
				/>
			</label>
			<select
				aria-label="Lọc theo vai trò"
				value={props.role ?? ""}
				onChange={(event) =>
					props.onRoleChange((event.target.value || undefined) as UserRole | undefined)
				}
				className="rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm"
			>
				<option value="">Tất cả vai trò</option>
				{USER_ROLE_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			<select
				aria-label="Lọc theo trạng thái"
				value={props.status ?? ""}
				onChange={(event) =>
					props.onStatusChange((event.target.value || undefined) as UserStatus | undefined)
				}
				className="rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm"
			>
				<option value="">Tất cả trạng thái</option>
				{USER_STATUS_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
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
