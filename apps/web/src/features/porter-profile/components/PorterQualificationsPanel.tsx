import { AlertCircle, CheckCircle2, Compass, Loader2, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { PorterRouteProficiency, PorterRouteQualification } from "../types";
import { PorterQualificationCard } from "./PorterQualificationCard";
import { PorterQualificationDialog } from "./PorterQualificationDialog";

interface RouteOption {
	id: string;
	name: string;
}

interface PorterQualificationsPanelProps {
	qualifications: PorterRouteQualification[];
	isLoading: boolean;
	isSubmitting: boolean;
	errorMessage: string | null;
	successMessage: string | null;
	conflictMessage: string | null;
	availableRoutes: RouteOption[];
	onUpsert: (
		routeId: string,
		values: {
			proficiency: PorterRouteProficiency;
			timesLed: number;
			expectedVersion?: number;
		}
	) => Promise<PorterRouteQualification | null>;
	onReload: () => Promise<void>;
}

export function PorterQualificationsPanel({
	qualifications,
	isLoading,
	isSubmitting,
	errorMessage,
	successMessage,
	conflictMessage,
	availableRoutes,
	onUpsert,
	onReload,
}: PorterQualificationsPanelProps) {
	const [selectedQualification, setSelectedQualification] =
		useState<PorterRouteQualification | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const handleOpenCreate = () => {
		setSelectedQualification(null);
		setIsDialogOpen(true);
	};

	const handleOpenEdit = (qual: PorterRouteQualification) => {
		setSelectedQualification(qual);
		setIsDialogOpen(true);
	};

	const handleDialogSubmit = async (
		routeId: string,
		values: {
			proficiency: PorterRouteProficiency;
			timesLed: number;
			expectedVersion?: number;
		}
	) => {
		const result = await onUpsert(routeId, values);
		return result !== null;
	};

	const routeNamesMap = new Map<string, string>(availableRoutes.map((r) => [r.id, r.name]));

	return (
		<section
			data-testid="porter-qualifications-panel"
			className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm sm:p-8"
		>
			{/* Panel Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#e7eee7] pb-5">
				<div>
					<h2 className="text-lg font-extrabold text-[#10221b]">
						Chứng chỉ & Năng lực tuyến trekking
					</h2>
					<p className="mt-0.5 text-xs text-[#627769]">
						Khai báo độ thành thạo và số lần dẫn đoàn cho từng tuyến để Host/Admin xác minh điều
						kiện làm Trưởng nhóm.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onReload}
						disabled={isLoading}
						aria-label="Tải lại danh sách"
						className="flex size-9 items-center justify-center rounded-xl border border-[#d2ded2] text-[#4a5e51] hover:bg-[#f4f7f2]"
					>
						<RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
					</button>
					<button
						type="button"
						onClick={handleOpenCreate}
						disabled={isSubmitting}
						data-testid="add-qualification-button"
						className="flex items-center gap-1.5 rounded-xl bg-[#164027] px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#205234] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Plus size={15} />
						<span>Thêm chứng chỉ tuyến</span>
					</button>
				</div>
			</div>

			{/* Status Feedback Banners */}
			{successMessage && (
				<div
					data-testid="qualification-success-alert"
					className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 shadow-xs animate-in fade-in"
				>
					<CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
					<span>{successMessage}</span>
				</div>
			)}

			{conflictMessage && (
				<div
					data-testid="qualification-conflict-alert"
					className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900 shadow-xs"
				>
					<AlertCircle size={16} className="shrink-0 text-amber-600" />
					<span>{conflictMessage}</span>
				</div>
			)}

			{errorMessage && (
				<div
					data-testid="qualification-error-alert"
					className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900 shadow-xs"
				>
					<AlertCircle size={16} className="shrink-0 text-red-600" />
					<span>{errorMessage}</span>
				</div>
			)}

			{/* Main Content */}
			<div className="mt-6">
				{isLoading && qualifications.length === 0 ? (
					<div
						data-testid="qualifications-loading"
						className="flex flex-col items-center justify-center py-12 text-[#627769]"
					>
						<Loader2 size={32} className="animate-spin text-[#164027]" />
						<p className="mt-3 text-xs font-bold">Đang tải danh sách chứng chỉ tuyến...</p>
					</div>
				) : qualifications.length === 0 ? (
					<div
						data-testid="qualifications-empty-state"
						className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d2ded2] bg-[#f9fbf9] p-10 text-center"
					>
						<div className="flex size-14 items-center justify-center rounded-2xl bg-[#eef7f0] text-[#164027]">
							<Compass size={28} />
						</div>
						<h4 className="mt-3 font-extrabold text-[#10221b]">
							Chưa có chứng chỉ tuyến trekking nào
						</h4>
						<p className="mt-1 max-w-md text-xs text-[#627769]">
							Bạn chưa đăng ký năng lực cho tuyến trekking nào. Hãy thêm tuyến để Host và Admin có
							thể xác minh và phân công ca dẫn đoàn.
						</p>
						<button
							type="button"
							onClick={handleOpenCreate}
							className="mt-4 flex items-center gap-1.5 rounded-xl bg-[#164027] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#205234]"
						>
							<Plus size={14} />
							<span>Thêm chứng chỉ tuyến đầu tiên</span>
						</button>
					</div>
				) : (
					<div
						data-testid="qualifications-grid"
						className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
					>
						{qualifications.map((qual) => (
							<PorterQualificationCard
								key={qual.qualificationId}
								qualification={qual}
								routeName={routeNamesMap.get(qual.routeId)}
								onEdit={() => handleOpenEdit(qual)}
								disabled={isSubmitting}
							/>
						))}
					</div>
				)}
			</div>

			{/* Create/Edit Dialog */}
			<PorterQualificationDialog
				isOpen={isDialogOpen}
				onClose={() => setIsDialogOpen(false)}
				qualification={selectedQualification}
				existingRouteIds={qualifications.map((q) => q.routeId)}
				availableRoutes={availableRoutes}
				onSubmit={handleDialogSubmit}
				isSubmitting={isSubmitting}
			/>
		</section>
	);
}
