import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
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
	return (
		<div className="space-y-3">
			<label className="block text-sm font-semibold">
				Lọc trạng thái
				<select
					className={LEVEL_INPUT_CLASS}
					value={filters.status ?? ""}
					onChange={(event) =>
						onChange({
							...filters,
							page: 1,
							status: (event.target.value || undefined) as RequestStatus | undefined,
						})
					}
				>
					<option value="">Tất cả trạng thái</option>
					{Object.entries(REQUEST_STATUS_LABELS).map(([code, label]) => (
						<option key={code} value={code}>
							{label}
						</option>
					))}
				</select>
			</label>
			{admin && (
				<form
					className="flex flex-wrap items-end gap-3"
					onSubmit={handleSubmit((data) =>
						onChange({
							...filters,
							page: 1,
							search: data.search || undefined,
						})
					)}
				>
					<label className="min-w-0 flex-1 text-sm font-semibold">
						Tìm Porter hoặc tuyến
						<input
							className={LEVEL_INPUT_CLASS}
							placeholder="Nhập tên Porter hoặc tên tuyến"
							{...register("search")}
						/>
						{errors.search && <span role="alert">{errors.search.message}</span>}
					</label>
					<Button type="submit" variant="outline">
						Tìm kiếm
					</Button>
					<Button
						variant="ghost"
						onClick={() => {
							reset();
							onChange({ page: 1 });
						}}
					>
						Đặt lại
					</Button>
				</form>
			)}
		</div>
	);
}
