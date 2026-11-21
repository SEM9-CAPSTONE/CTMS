import { useState } from "react";
import { Button } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { useAdminModerationCounts } from "../../admin-layout/hooks/useAdminModerationCounts";
import {
	type LevelTab,
	PorterManagementTabs,
} from "../../admin-porter-verifications/components/PorterManagementTabs";
import { AdminGlobalPorterLevelsPanel } from "../components/AdminGlobalPorterLevelsPanel";
import { AdminLevelRequestsPanel } from "../components/AdminLevelRequestsPanel";
import { LevelPolicyForm } from "../components/LevelPolicyForm";
import { LEVEL_CODES, LEVEL_PANEL_CLASS, levelName, levelReviewError } from "../constants";
import { useAdminPorterLevels } from "../hooks/usePorterLevels";
import type { PorterLevel } from "../types";

export function AdminPorterLevelsPage({
	onLogout,
}: { onLogout?: (allDevices: boolean) => Promise<void> }) {
	const [level, setLevel] = useState<PorterLevel>("learning");
	const [tab, setTab] = useState<"levels" | "policies">(() => {
		const view = new URLSearchParams(window.location.search).get("view");
		return view === "policies" ? "policies" : "levels";
	});
	const [levelSubTab, setLevelSubTab] = useState<"global" | "requests">(() => {
		const params = new URLSearchParams(window.location.search);
		return params.get("request") || params.get("subtab") === "requests" ? "requests" : "global";
	});
	const [requestsTabSeen, setRequestsTabSeen] = useState(false);
	const moderationCounts = useAdminModerationCounts();
	const pendingRequestsBadge = requestsTabSeen
		? 0
		: (moderationCounts.data?.porterLevelRequests ?? 0);

	const state = useAdminPorterLevels(1, null, level);
	const policy = state.policies.data?.find((item) => item.level === level) ?? null;
	const chooseLevel = (value: PorterLevel) => {
		setLevel(value);
		state.savePolicy.reset();
	};

	const handleTabSelect = (next: LevelTab) => {
		if (next === "policies") {
			setTab("policies");
			window.history.replaceState({}, "", "/admin/porter-levels?view=policies");
		} else {
			setTab("levels");
			window.history.replaceState({}, "", "/admin/porter-levels");
		}
	};

	return (
		<AdminLayout activeItem="porter-levels" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<PorterManagementTabs
					active={tab}
					onSelect={handleTabSelect}
					hideLevelBadge={requestsTabSeen}
				/>

				{/* TAB: XÉT CẤP ĐỘ (CHUYỂN ĐỔI GỌN GIỮA PHÂN CẤP TỔNG QUÁT VÀ YÊU CẦU NÂNG CẤP) */}
				{tab === "levels" && (
					<div className="space-y-4">
						<div
							role="tablist"
							aria-label="Chế độ xem xét cấp độ"
							className="inline-flex rounded-xl border border-[#dfe8df] bg-white p-1 shadow-xs"
						>
							<button
								type="button"
								role="tab"
								aria-selected={levelSubTab === "global"}
								onClick={() => setLevelSubTab("global")}
								className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
									levelSubTab === "global"
										? "bg-[#164027] text-white"
										: "text-[#4a5e51] hover:bg-[#f4f7f2]"
								}`}
							>
								Danh sách cấp bậc
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={levelSubTab === "requests"}
								onClick={() => {
									setLevelSubTab("requests");
									setRequestsTabSeen(true);
								}}
								className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
									levelSubTab === "requests"
										? "bg-[#164027] text-white"
										: "text-[#4a5e51] hover:bg-[#f4f7f2]"
								}`}
							>
								<span>Yêu cầu nâng cấp</span>
								{pendingRequestsBadge > 0 && (
									<span
										className={`inline-flex min-w-4.5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
											levelSubTab === "requests"
												? "bg-white/25 text-white"
												: "bg-rose-600 text-white"
										}`}
									>
										{pendingRequestsBadge}
									</span>
								)}
							</button>
						</div>

						{levelSubTab === "global" ? (
							<AdminGlobalPorterLevelsPanel />
						) : (
							<AdminLevelRequestsPanel />
						)}
					</div>
				)}

				{/* TAB: TIÊU CHÍ CẤP ĐỘ */}
				{tab === "policies" && (
					<section className={LEVEL_PANEL_CLASS}>
						<div className="border-b border-[#dfe8df] pb-4 mb-4">
							<h2 className="text-lg font-bold text-[#10221b]">Tiêu chí và phạm vi phụ trách</h2>
							<p className="mt-0.5 text-xs text-[#627769]">
								Cấu hình điều kiện kinh nghiệm, chứng chỉ và kỹ năng để xét duyệt cấp độ
							</p>
						</div>

						<div className="mb-5 flex flex-wrap gap-2" aria-label="Chọn cấp người hỗ trợ">
							{LEVEL_CODES.map((code) => (
								<Button
									key={code}
									variant={level === code ? "primary" : "outline"}
									disabled={state.savePolicy.isPending}
									onClick={() => chooseLevel(code)}
								>
									{levelName(code, state.policies.data)}
								</Button>
							))}
						</div>

						{state.policies.isPending && <output>Đang tải tiêu chí…</output>}
						{state.policies.isError && (
							<p role="alert">
								{levelReviewError(state.policies.error)}{" "}
								<Button onClick={() => void state.policies.refetch()}>Thử lại</Button>
							</p>
						)}
						{state.policies.isSuccess && (
							<LevelPolicyForm
								key={`${level}-${policy?.version ?? 0}`}
								policy={policy}
								pending={state.savePolicy.isPending}
								error={state.savePolicy.error}
								onSave={state.savePolicy.mutateAsync}
							/>
						)}
						{state.savePolicy.isSuccess && (
							<output className="mt-3 block text-xs font-bold text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
								Đã lưu tiêu chí thành công. Các cấp đã duyệt trước đó không tự động thay đổi.
							</output>
						)}
					</section>
				)}
			</div>
		</AdminLayout>
	);
}
