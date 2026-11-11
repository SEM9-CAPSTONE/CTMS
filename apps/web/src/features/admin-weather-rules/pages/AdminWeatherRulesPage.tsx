import { AlertCircle, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { Card, ConfirmModal } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { ActiveRuleCard } from "../components/ActiveRuleCard";
import { CreateRuleDialog } from "../components/CreateRuleDialog";
import { RuleVersionsTable } from "../components/RuleVersionsTable";
import { useAdminWeatherRules } from "../hooks/useAdminWeatherRules";

export interface AdminWeatherRulesPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminWeatherRulesPage({ onLogout }: AdminWeatherRulesPageProps) {
	const {
		rules,
		activeRule,
		isLoading,
		error,
		isCreateModalOpen,
		setIsCreateModalOpen,
		pendingActivateRule,
		setPendingActivateRule,
		isCreating,
		isActivating,
		createRule,
		activateRule,
		reload,
	} = useAdminWeatherRules();

	return (
		<AdminLayout activeItem="weather-rules" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<ShieldAlert className="size-7 text-[#164027]" /> Cấu hình rủi ro thời tiết
						</h1>
					</div>

					<button
						type="button"
						data-testid="btn-open-create-modal"
						onClick={() => setIsCreateModalOpen(true)}
						className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition-all hover:bg-[#10301d] active:scale-95 cursor-pointer shrink-0"
					>
						<Plus className="size-4" />
						Tạo phiên bản quy tắc mới
					</button>
				</div>

				{/* Global Error Banner */}
				{error && (
					<div
						role="alert"
						data-testid="rules-error-banner"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5 shrink-0" />
							<span>{error}</span>
						</span>
						<button
							type="button"
							onClick={reload}
							className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs text-white hover:bg-red-800 transition-colors cursor-pointer"
						>
							<RefreshCw className="size-4" /> Thử lại
						</button>
					</div>
				)}

				{/* Active Rule Card */}
				{!isLoading && <ActiveRuleCard activeRule={activeRule} />}

				{/* Rule Versions History */}
				<Card className="overflow-hidden p-0 space-y-0">
					<div className="border-b border-[#e8efe7] bg-[#f8faf8] px-6 py-4 flex items-center justify-between">
						<div>
							<h3 className="font-extrabold text-[#10221b] text-base">
								Lịch sử các phiên bản quy tắc
							</h3>
						</div>
						<span className="text-xs font-extrabold text-[#164027] bg-[#eef7f0] px-3 py-1 rounded-full border border-emerald-200">
							Tổng cộng {rules.length} phiên bản
						</span>
					</div>

					{isLoading ? (
						<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
							<RefreshCw className="size-5 animate-spin text-[#164027]" /> Đang tải lịch sử bộ quy
							tắc...
						</div>
					) : (
						<RuleVersionsTable
							rules={rules}
							onActivateClick={(rule) => setPendingActivateRule(rule)}
							isActivating={isActivating}
						/>
					)}
				</Card>
			</div>

			{/* Create New Rule Dialog */}
			<CreateRuleDialog
				isOpen={isCreateModalOpen}
				isSubmitting={isCreating}
				onClose={() => setIsCreateModalOpen(false)}
				onSubmit={async (payload) => {
					await createRule(payload);
				}}
			/>

			{/* Activate Rule Confirmation Modal */}
			<ConfirmModal
				isOpen={pendingActivateRule !== null}
				onClose={() => setPendingActivateRule(null)}
				onConfirm={async () => {
					if (pendingActivateRule) {
						await activateRule(pendingActivateRule.id);
					}
				}}
				isLoading={isActivating}
				variant="success"
				title="Xác nhận kích hoạt bộ quy tắc"
				confirmText="Xác nhận kích hoạt"
				cancelText="Hủy bỏ"
				description={
					<span>
						Bạn có chắc chắn muốn kích hoạt **Bộ quy tắc Phiên bản v{pendingActivateRule?.version}
						**? Bộ quy tắc đang áp dụng hiện tại sẽ chuyển sang trạng thái không hoạt động.
					</span>
				}
			/>
		</AdminLayout>
	);
}
