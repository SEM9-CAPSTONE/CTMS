import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
import { SelectField } from "../../../shared/components/SelectField";
import { LEVEL_INPUT_CLASS, REQUEST_STATUS_LABELS } from "../constants";
import type { RequestFilters, RequestStatus } from "../request-types";
import { requestFilterSchema } from "../schema/level-request.schema";
export function LevelRequestFilters({
	admin,
	filters,
	onChange,
}: { admin: boolean; filters: RequestFilters; onChange: (filters: RequestFilters) => void }) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<z.infer<typeof requestFilterSchema>>({
		resolver: zodResolver(requestFilterSchema),
		defaultValues: { search: filters.search ?? "" },
	});
	const statusOptions = admin
		? [
				{ value: "pending", label: REQUEST_STATUS_LABELS.pending },
				{ value: "rejected", label: REQUEST_STATUS_LABELS.rejected },
			]
		: [
				{ value: "", label: "Tất cả trạng thái" },
				...Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => ({ value, label })),
			];

	return (
		<div className="flex flex-wrap items-end gap-3">
			<label className="block w-full text-sm font-semibold sm:w-48">
				<span className="sr-only">Lọc trạng thái</span>
				<SelectField
					label="Lọc trạng thái"
					value={filters.status ?? (admin ? "pending" : "")}
					onChange={(value) =>
						onChange({
							...filters,
							page: 1,
							status: (value || undefined) as RequestStatus | undefined,
						})
					}
					options={statusOptions}
				/>
			</label>
			{admin && (
				<form
					className="flex min-w-0 flex-1 flex-wrap items-end gap-3"
					onSubmit={handleSubmit((data) =>
						onChange({
							...filters,
							page: 1,
							search: data.search || undefined,
						})
					)}
				>
					<label className="min-w-0 flex-1 text-sm font-semibold">
						<span className="sr-only">Tìm người hỗ trợ</span>
						<input
							className={LEVEL_INPUT_CLASS}
							placeholder="Tìm theo tên người hỗ trợ..."
							{...register("search")}
						/>
						{errors.search && <span role="alert">{errors.search.message}</span>}
					</label>
					<Button type="submit">Tìm kiếm</Button>
					<Button
						variant="outline"
						onClick={() => {
							reset();
							onChange({ page: 1, status: admin ? "pending" : undefined });
						}}
					>
						<RotateCcw aria-hidden="true" className="mr-2 size-4" />
						Đặt lại
					</Button>
				</form>
			)}
		</div>
	);
}
