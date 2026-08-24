import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, FileUp, Loader2, RefreshCw } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { CreatedCampsite } from "../../campsites/types";
import type { CreateRouteError } from "../hooks/useCreateTrekkingRoute";
import {
	CREATE_TREKKING_ROUTE_DEFAULT_VALUES,
	type CreateTrekkingRouteFormValues,
	createTrekkingRouteFormSchema,
	toCreateTrekkingRouteInput,
} from "../schema/create-trekking-route.schema";
import type { CreateTrekkingRouteInput } from "../types";
import { parseRouteImportFile } from "../utils/route-import";
import { RouteGeometryEditor } from "./RouteGeometryEditor";

interface Props {
	campsites: CreatedCampsite[];
	initialCampsiteId?: string;
	isSubmitting: boolean;
	error: CreateRouteError | null;
	onSubmit: (payload: CreateTrekkingRouteInput) => Promise<unknown>;
	onRetry: () => Promise<unknown>;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10";

export function CreateTrekkingRouteForm({
	campsites,
	initialCampsiteId,
	isSubmitting,
	error,
	onSubmit,
	onRetry,
}: Props) {
	const {
		register,
		control,
		handleSubmit,
		setError,
		clearErrors,
		formState: { errors },
	} = useForm<CreateTrekkingRouteFormValues>({
		resolver: zodResolver(createTrekkingRouteFormSchema),
		defaultValues: {
			...CREATE_TREKKING_ROUTE_DEFAULT_VALUES,
			campsiteId: initialCampsiteId ?? "",
		},
	});

	const importFile = async (file: File | undefined) => {
		if (!file) return;
		try {
			const geometry = await parseRouteImportFile(file);
			clearErrors("geometry");
			return geometry;
		} catch (importError) {
			setError("geometry", {
				message:
					importError instanceof Error ? importError.message : "Không thể đọc tệp tuyến đường.",
			});
		}
	};

	return (
		<form
			className="grid gap-5"
			onSubmit={handleSubmit((values) => onSubmit(toCreateTrekkingRouteInput(values)))}
		>
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="font-extrabold text-[#10221b]">Thông tin tuyến đường</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<label className="text-sm font-bold text-[#34483b]">
						Khu cắm trại
						<select
							aria-label="Khu cắm trại"
							disabled={isSubmitting}
							className={inputClass}
							{...register("campsiteId")}
						>
							<option value="">Chọn khu cắm trại</option>
							{campsites.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name}
								</option>
							))}
						</select>
						{errors.campsiteId && (
							<span className="mt-1 block text-xs text-red-600">{errors.campsiteId.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Tên tuyến
						<input
							aria-label="Tên tuyến"
							disabled={isSubmitting}
							maxLength={150}
							className={inputClass}
							{...register("name")}
						/>
						{errors.name && (
							<span className="mt-1 block text-xs text-red-600">{errors.name.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Độ khó
						<select
							aria-label="Độ khó"
							disabled={isSubmitting}
							className={inputClass}
							{...register("difficulty")}
						>
							<option value="easy">Dễ</option>
							<option value="moderate">Trung bình</option>
							<option value="hard">Khó</option>
							<option value="expert">Chuyên gia</option>
						</select>
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Thời lượng dự kiến (phút)
						<input
							aria-label="Thời lượng dự kiến (phút)"
							inputMode="numeric"
							disabled={isSubmitting}
							className={inputClass}
							{...register("expectedDurationMinutes")}
						/>
						{errors.expectedDurationMinutes && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.expectedDurationMinutes.message}
							</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
						Mô tả (không bắt buộc)
						<textarea
							aria-label="Mô tả"
							disabled={isSubmitting}
							rows={3}
							className={inputClass}
							{...register("description")}
						/>
					</label>
				</div>
			</section>

			<Controller
				name="geometry"
				control={control}
				render={({ field }) => (
					<>
						<RouteGeometryEditor
							value={field.value}
							disabled={isSubmitting}
							onChange={field.onChange}
						/>
						<div className="rounded-2xl border border-dashed border-[#b8cbbd] bg-white p-4">
							<label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-[#164027]">
								<FileUp className="size-5" />
								Nhập GPX hoặc GeoJSON (tối đa 5 MB)
								<input
									aria-label="Nhập GPX hoặc GeoJSON"
									type="file"
									accept=".gpx,.geojson,.json,application/gpx+xml,application/geo+json,application/json"
									disabled={isSubmitting}
									className="sr-only"
									onChange={async (event) => {
										const geometry = await importFile(event.target.files?.[0]);
										if (geometry) field.onChange(geometry);
										event.target.value = "";
									}}
								/>
							</label>
							<p className="mt-1 text-xs text-[#667a6d]">
								Hình học nhập thành công sẽ thay thế đường đang vẽ và có thể tiếp tục chỉnh sửa.
							</p>
						</div>
					</>
				)}
			/>
			{errors.geometry && (
				<p role="alert" className="text-sm font-bold text-red-600">
					{errors.geometry.message ?? "Tuyến đường chưa hợp lệ."}
				</p>
			)}

			{error && (
				<div
					role="alert"
					className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
				>
					<div className="flex gap-2">
						<AlertCircle className="size-5 shrink-0" />
						<span>{error.message}</span>
					</div>
					{error.canRetry && (
						<button
							type="button"
							onClick={() => void onRetry()}
							className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" />
							Thử lại
						</button>
					)}
				</div>
			)}
			<button
				type="submit"
				disabled={isSubmitting}
				className="flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-60"
			>
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				{isSubmitting ? "Đang tạo tuyến..." : "Tạo tuyến đường"}
			</button>
		</form>
	);
}
