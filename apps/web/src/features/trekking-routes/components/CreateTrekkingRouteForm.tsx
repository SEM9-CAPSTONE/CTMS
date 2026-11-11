import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { RouteDurationAdvice } from "../../route-safety/components/RouteDurationAdvice";
import { useRouteTerrain } from "../../route-safety/hooks/useRouteTerrain";
import type { CreateRouteError } from "../hooks/useCreateTrekkingRoute";
import {
	CREATE_TREKKING_ROUTE_DEFAULT_VALUES,
	type CreateTrekkingRouteFormValues,
	createTrekkingRouteFormSchema,
	toCreateTrekkingRouteInput,
} from "../schema/create-trekking-route.schema";
import {
	type CreateTrekkingRouteInput,
	type CreatedTrekkingRoute,
	ROUTE_SAVE_INTENTS,
	type RouteSaveIntent,
} from "../types";
import { RouteFormActions } from "./RouteFormActions";
import { RouteGeometryEditor } from "./RouteGeometryEditor";

interface Props {
	route?: CreatedTrekkingRoute;
	onCancel?: () => void;
	isSubmitting: boolean;
	isSendingForApproval?: boolean;
	error: CreateRouteError | null;
	onSubmit: (payload: CreateTrekkingRouteInput) => Promise<unknown>;
	onSubmitForApproval?: (payload: CreateTrekkingRouteInput) => Promise<unknown>;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10";

export function CreateTrekkingRouteForm({
	route,
	onCancel,
	isSubmitting,
	isSendingForApproval = false,
	error,
	onSubmit,
	onSubmitForApproval,
}: Props) {
	const {
		register,
		control,
		handleSubmit,
		setFocus,
		formState: { errors },
	} = useForm<CreateTrekkingRouteFormValues>({
		resolver: zodResolver(createTrekkingRouteFormSchema),
		defaultValues: route
			? {
					name: route.name,
					description: route.description ?? "",
					difficulty: route.difficulty,
					geometry: route.geometry,
					expectedDurationMinutes: String(route.expectedDurationMinutes),
				}
			: CREATE_TREKKING_ROUTE_DEFAULT_VALUES,
	});
	const geometry = useWatch({ control, name: "geometry" });
	const duration = useWatch({ control, name: "expectedDurationMinutes" });
	const assessment = useRouteTerrain(geometry, duration);
	const submittedGeometry = useRef<string>();
	const lastIntent = useRef<RouteSaveIntent>(ROUTE_SAVE_INTENTS.SAVE);
	const serverDurationError =
		error?.minimumMinutes &&
		submittedGeometry.current === JSON.stringify(geometry) &&
		Number(duration) > 0 &&
		Number(duration) < error.minimumMinutes;
	const minimumMinutes =
		serverDurationError && error?.minimumMinutes ? error.minimumMinutes : assessment.minimumMinutes;

	return (
		<form
			className="grid gap-5"
			onSubmit={handleSubmit(async (values, event) => {
				if (isSubmitting) return;
				if (assessment.warning || serverDurationError) {
					setFocus("expectedDurationMinutes");
					return;
				}
				submittedGeometry.current = JSON.stringify(values.geometry);
				const submitter = (event?.nativeEvent as SubmitEvent | undefined)?.submitter;
				lastIntent.current =
					submitter instanceof HTMLButtonElement && submitter.value === ROUTE_SAVE_INTENTS.SUBMIT
						? ROUTE_SAVE_INTENTS.SUBMIT
						: ROUTE_SAVE_INTENTS.SAVE;
				const action =
					lastIntent.current === ROUTE_SAVE_INTENTS.SUBMIT ? onSubmitForApproval : onSubmit;
				await action?.(toCreateTrekkingRouteInput(values));
			})}
		>
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="font-extrabold text-[#10221b]">Thông tin tuyến đường</h2>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
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
							aria-invalid={
								Boolean(errors.expectedDurationMinutes) ||
								assessment.warning ||
								Boolean(serverDurationError)
							}
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
						{!errors.expectedDurationMinutes && (
							<RouteDurationAdvice
								invalid={assessment.warning || Boolean(serverDurationError)}
								minimumMinutes={minimumMinutes}
							/>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
						Mô tả
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
					<RouteGeometryEditor
						routeId={route?.id}
						value={field.value}
						disabled={isSubmitting}
						onChange={field.onChange}
					/>
				)}
			/>
			{errors.geometry && (
				<p role="alert" className="text-sm font-bold text-red-600">
					{errors.geometry.message ?? "Tuyến đường chưa hợp lệ."}
				</p>
			)}

			{error && !error.minimumMinutes && (
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
							type="submit"
							name="routeAction"
							value={lastIntent.current}
							disabled={isSubmitting}
							className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" />
							Thử lại
						</button>
					)}
				</div>
			)}
			<RouteFormActions
				isEditing={Boolean(route)}
				isSubmitting={isSubmitting}
				isSendingForApproval={isSendingForApproval}
				canSubmitForApproval={Boolean(onSubmitForApproval)}
			/>
			{onCancel && (
				<button
					type="button"
					disabled={isSubmitting}
					onClick={onCancel}
					className="rounded-xl border px-5 py-3 font-bold"
				>
					Hủy chỉnh sửa
				</button>
			)}
		</form>
	);
}
