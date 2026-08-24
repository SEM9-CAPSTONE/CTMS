import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	FileText,
	Loader2,
	RefreshCw,
	TentTree,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { CreateCampsiteForm } from "../components/CreateCampsiteForm";
import { useCreateCampsite } from "../hooks/useCreateCampsite";
import { useUpdateCampsite } from "../hooks/useUpdateCampsite";
import {
	type CreateCampsiteFormValues,
	toEditCampsiteFormValues,
	toUpdateCampsiteInput,
} from "../schema/create-campsite.schema";
import { campsitesService } from "../services/campsites.service";
import type { CreateCampsiteInput, CreatedCampsite } from "../types";

export interface CampsiteFormPageProps {
	mode?: "create" | "edit";
	campsiteId?: string;
	onBackHome?: () => void;
}

function mapLoadError(error: unknown): string {
	if (error instanceof Error && error.message === "Campsite not found in Host ownership list") {
		return "Không tìm thấy khu cắm trại thuộc quyền quản lý của bạn.";
	}

	return "Không thể tải thông tin khu cắm trại. Vui lòng thử lại.";
}

export function CampsiteFormPage({
	mode = "create",
	campsiteId = "",
	onBackHome,
}: CampsiteFormPageProps) {
	const isEditMode = mode === "edit";
	const [campsite, setCampsite] = useState<CreatedCampsite | null>(null);
	const [isLoading, setIsLoading] = useState(isEditMode);
	const [loadError, setLoadError] = useState("");
	const createState = useCreateCampsite();
	const updateState = useUpdateCampsite(campsiteId);
	const resetUpdateState = updateState.reset;

	const loadCampsite = useCallback(() => {
		if (!isEditMode || !campsiteId) {
			return;
		}

		setIsLoading(true);
		setLoadError("");

		void campsitesService
			.getById(campsiteId)
			.then((data) => {
				setCampsite(data);
				resetUpdateState();
			})
			.catch((error: unknown) => {
				setCampsite(null);
				setLoadError(mapLoadError(error));
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [campsiteId, isEditMode, resetUpdateState]);

	useEffect(() => {
		if (isEditMode) {
			loadCampsite();
		} else {
			setCampsite(null);
			setIsLoading(false);
			setLoadError("");
		}
	}, [isEditMode, loadCampsite]);

	const defaultValues = useMemo(
		() => (isEditMode && campsite ? toEditCampsiteFormValues(campsite) : undefined),
		[isEditMode, campsite]
	);

	const submitEdit = async (_payload: CreateCampsiteInput, values: CreateCampsiteFormValues) => {
		if (!campsite) {
			return null;
		}

		return updateState.submit(toUpdateCampsiteInput(values, campsite.updatedAt));
	};

	const successCampsite = isEditMode ? updateState.updatedCampsite : createState.createdCampsite;

	if (successCampsite) {
		return (
			<div className="min-h-screen bg-[#f4f7f2] font-sans">
				<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
					<div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
						<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-50 text-green-600">
							<CheckCircle2 className="size-9" />
						</div>

						<h1 className="mt-5 text-2xl font-extrabold text-[#10221b]">
							{isEditMode ? "Cập nhật khu cắm trại thành công" : "Tạo khu cắm trại thành công"}
						</h1>

						<p className="mt-2 text-sm text-[#667a6d]">
							{isEditMode
								? "Thông tin mới đã được lưu và sẽ hiển thị theo trạng thái hiện tại của khu cắm trại."
								: "Khu cắm trại đã được gửi và đang chờ Admin duyệt."}
						</p>

						<div className="mt-6 rounded-xl border border-[#e0ebe0] bg-[#f8faf7] p-5 text-left">
							<div className="flex items-start justify-between gap-4">
								<div>
									<p className="text-lg font-extrabold text-[#10221b]">{successCampsite.name}</p>
									<p className="mt-1 text-sm text-[#667a6d]">{successCampsite.province}</p>
								</div>

								{!isEditMode && (
									<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold uppercase text-amber-700">
										{successCampsite.status === "pending_approval"
											? "pending"
											: successCampsite.status}
									</span>
								)}
							</div>

							<div className="mt-4 flex items-center gap-2 text-xs text-[#788b7e]">
								<FileText className="size-4" />
								ID:
								<span
									data-testid={isEditMode ? "updated-campsite-id" : "created-campsite-id"}
									className="font-mono"
								>
									{successCampsite.id}
								</span>
							</div>
						</div>

						<div className="mt-6 flex flex-wrap justify-center gap-3">
							<button
								type="button"
								onClick={() => {
									if (isEditMode) {
										setCampsite(successCampsite);
										updateState.reset();
									} else {
										createState.reset();
									}
								}}
								className="rounded-xl bg-[#164027] px-5 py-3 text-sm font-bold text-white"
							>
								{isEditMode ? "Tiếp tục chỉnh sửa" : "Tạo khu cắm trại khác"}
							</button>

							{onBackHome && (
								<button
									type="button"
									onClick={onBackHome}
									className="rounded-xl border border-[#cbd9ce] bg-white px-5 py-3 text-sm font-bold text-[#164027]"
								>
									Về Host Dashboard
								</button>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans antialiased">
			<header className="border-b border-[#dfe8df] bg-white">
				<div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-5 sm:px-6">
					{onBackHome && (
						<button
							type="button"
							aria-label="Quay về Host Dashboard"
							onClick={onBackHome}
							className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#dfe8df] text-[#164027] hover:bg-[#f4f7f2]"
						>
							<ArrowLeft className="size-5" />
						</button>
					)}

					<div className="flex size-11 items-center justify-center rounded-xl bg-[#eaf4eb] text-[#164027]">
						<TentTree className="size-6" />
					</div>

					<div>
						<h1 className="text-xl font-extrabold text-[#10221b] sm:text-2xl">
							{isEditMode ? "Chỉnh sửa Khu cắm trại" : "Tạo Khu cắm trại"}
						</h1>

						<p className="mt-0.5 text-sm text-[#667a6d]">
							{isEditMode
								? "Dữ liệu đã nhập sẽ được giữ nguyên nếu API báo xung đột."
								: "Thông tin đang nhập sẽ được tự lưu nháp trên thiết bị này."}
						</p>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
				{isEditMode && isLoading && (
					<div className="flex items-center gap-2 rounded-2xl border border-[#e5eee7] bg-white p-5 text-sm font-bold text-[#667a6d]">
						<Loader2 className="size-4 animate-spin text-[#164027]" />
						Đang tải thông tin khu cắm trại...
					</div>
				)}

				{isEditMode && loadError && !isLoading && (
					<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
						<div className="flex items-start gap-3">
							<AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
							<div className="flex-1">
								<p className="text-sm font-bold text-red-800">{loadError}</p>
								<Button
									type="button"
									variant="outline"
									onClick={loadCampsite}
									className="mt-4 gap-2"
								>
									<RefreshCw className="size-4" />
									<span>Tải lại</span>
								</Button>
							</div>
						</div>
					</div>
				)}

				{isEditMode && !isLoading && !loadError && !campsite && (
					<div className="rounded-2xl border border-dashed border-[#cbd9ce] bg-white p-8 text-center">
						<TentTree className="mx-auto size-9 text-[#8fa096]" />
						<p className="mt-2 text-sm font-extrabold text-[#10221b]">
							Không có khu cắm trại để chỉnh sửa
						</p>
					</div>
				)}

				{!isEditMode && (
					<CreateCampsiteForm
						isSubmitting={createState.isSubmitting}
						error={createState.error}
						onSubmit={createState.submit}
						onRetry={createState.retry}
					/>
				)}

				{isEditMode && !isLoading && !loadError && campsite && defaultValues && (
					<CreateCampsiteForm
						mode="edit"
						initialValues={defaultValues}
						isSubmitting={updateState.isSubmitting}
						error={updateState.error}
						onSubmit={submitEdit}
						onRetry={updateState.retry}
					/>
				)}
			</main>
		</div>
	);
}
