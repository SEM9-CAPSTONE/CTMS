import { useState } from "react";
import { Button, Modal, Pagination } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminLevelRequestsPanel } from "../components/AdminLevelRequestsPanel";
import { LevelDecisionForm } from "../components/LevelDecisionForm";
import { LevelPolicyForm } from "../components/LevelPolicyForm";
import { LevelQualificationsTable } from "../components/LevelQualificationsTable";
import { LevelReviewHistory } from "../components/LevelReviewHistory";
import {
	ADMIN_LEVEL_TABS,
	LEVEL_CODES,
	LEVEL_PANEL_CLASS,
	levelName,
	levelReviewError,
} from "../constants";
import { useAdminPorterLevels } from "../hooks/usePorterLevels";
import type { PorterLevel } from "../types";

export function AdminPorterLevelsPage({
	onLogout,
}: { onLogout?: (allDevices: boolean) => Promise<void> }) {
	const [level, setLevel] = useState<PorterLevel>("learning");
	const [tab, setTab] = useState<keyof typeof ADMIN_LEVEL_TABS>("requests");
	const [page, setPage] = useState(1);
	const [id, setId] = useState<string | null>(null);
	const state = useAdminPorterLevels(page, id, level);
	const policy = state.policies.data?.find((item) => item.level === level) ?? null;
	const chooseLevel = (value: PorterLevel) => {
		setLevel(value);
		state.savePolicy.reset();
		state.decide.reset();
	};
	return (
		<AdminLayout activeItem="porter-levels" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<h1 className="text-2xl font-extrabold">Cấp độ Porter</h1>
				<nav
					aria-label="Chức năng quản lý cấp Porter"
					className="flex flex-wrap gap-2 rounded-2xl border border-[#dfe8df] bg-white p-2"
				>
					{Object.entries(ADMIN_LEVEL_TABS).map(([key, label]) => (
						<Button
							key={key}
							variant={tab === key ? "primary" : "ghost"}
							aria-pressed={tab === key}
							disabled={state.savePolicy.isPending || state.decide.isPending}
							onClick={() => setTab(key as keyof typeof ADMIN_LEVEL_TABS)}
						>
							{label}
						</Button>
					))}
				</nav>
				{tab === "requests" && <AdminLevelRequestsPanel />}
				{tab === "policies" && (
					<section className={LEVEL_PANEL_CLASS}>
						<h2 className="mb-4 text-lg font-bold">Tiêu chí và phạm vi phụ trách</h2>
						<div className="mb-5 flex flex-wrap gap-2" aria-label="Chọn cấp Porter">
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
							<output className="mt-3 text-green-800">
								Đã lưu tiêu chí. Các cấp đã duyệt không tự thay đổi.
							</output>
						)}
					</section>
				)}
				{tab === "direct" && (
					<section className={LEVEL_PANEL_CLASS}>
						<div className="mb-4 flex items-center justify-between gap-3">
							<h2 className="text-lg font-bold">Năng lực Porter theo tuyến</h2>
							<Button variant="outline" onClick={() => void state.qualifications.refetch()}>
								Làm mới
							</Button>
						</div>
						{state.qualifications.isPending && <output>Đang tải danh sách…</output>}
						{state.qualifications.isError && (
							<p role="alert">{levelReviewError(state.qualifications.error)}</p>
						)}
						{state.qualifications.data?.items.length === 0 && (
							<p>
								Chưa có khai báo năng lực theo tuyến. Porter cần thêm tuyến trong Hồ sơ Porter
								trước.
							</p>
						)}
						<LevelQualificationsTable
							items={state.qualifications.data?.items ?? []}
							onReview={(qualificationId) => {
								setId(qualificationId);
								state.decide.reset();
							}}
						/>
						<Pagination
							currentPage={page}
							totalPages={Math.max(1, Math.ceil((state.qualifications.data?.total ?? 0) / 20))}
							totalItems={state.qualifications.data?.total ?? 0}
							itemsPerPage={20}
							onPageChange={setPage}
						/>
					</section>
				)}
			</div>
			<Modal
				isOpen={Boolean(id)}
				onClose={() => setId(null)}
				title="Xét cấp Porter theo tuyến"
				size="xl"
				isCloseDisabled={state.decide.isPending}
			>
				<div className="space-y-5">
					<label className="block text-sm font-semibold">
						Cấp đề xuất
						<select
							className="ml-3 rounded-lg border p-2"
							value={level}
							disabled={state.decide.isPending}
							onChange={(event) => chooseLevel(event.target.value as PorterLevel)}
						>
							{LEVEL_CODES.map((code) => (
								<option key={code} value={code}>
									{levelName(code, state.policies.data)}
								</option>
							))}
						</select>
					</label>
					<Button
						variant="outline"
						disabled={state.decide.isPending || state.comparison.isFetching}
						onClick={() => void state.comparison.refetch()}
					>
						Tải lại hồ sơ và tiêu chí
					</Button>
					{state.comparison.isPending && <output>Đang đối chiếu hồ sơ…</output>}
					{state.comparison.isError && (
						<p role="alert">{levelReviewError(state.comparison.error)}</p>
					)}
					{state.comparison.data && (
						<LevelDecisionForm
							key={`${id}-${level}`}
							context={state.comparison.data}
							pending={state.decide.isPending || state.comparison.isFetching}
							error={state.decide.error}
							onDecide={state.decide.mutateAsync}
						/>
					)}
					{state.history.isPending && <p>Đang tải lịch sử…</p>}
					{state.history.isError && (
						<p role="alert">
							Không tải được lịch sử.{" "}
							<Button onClick={() => void state.history.refetch()}>Thử lại</Button>
						</p>
					)}
					{state.history.data && <LevelReviewHistory items={state.history.data} />}
				</div>
			</Modal>
		</AdminLayout>
	);
}
