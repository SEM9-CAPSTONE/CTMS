import { RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { Button, Modal, Pagination } from "../../../shared/components";
import { SelectField } from "../../../shared/components/SelectField";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { PorterManagementTabs } from "../../admin-porter-verifications/components/PorterManagementTabs";
import { AdminLevelRequestsPanel } from "../components/AdminLevelRequestsPanel";
import { LevelDecisionForm } from "../components/LevelDecisionForm";
import { LevelPolicyForm } from "../components/LevelPolicyForm";
import { LevelQualificationsTable } from "../components/LevelQualificationsTable";
import { LevelReviewHistory } from "../components/LevelReviewHistory";
import {
	type ADMIN_LEVEL_TABS,
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
	const [tab, setTab] = useState<keyof typeof ADMIN_LEVEL_TABS>(() => {
		const view = new URLSearchParams(window.location.search).get("view");
		return view === "direct" || view === "policies" ? view : "requests";
	});
	const [page, setPage] = useState(1);
	const [id, setId] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const state = useAdminPorterLevels(page, id, level, search);
	const policy = state.policies.data?.find((item) => item.level === level) ?? null;
	const chooseLevel = (value: PorterLevel) => {
		setLevel(value);
		state.savePolicy.reset();
		state.decide.reset();
	};
	return (
		<AdminLayout activeItem="porter-levels" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				<PorterManagementTabs
					active={tab}
					onSelect={(next) => {
						setTab(next);
						window.history.replaceState({}, "", `/admin/porter-levels?view=${next}`);
					}}
				/>
				{tab === "requests" && <AdminLevelRequestsPanel />}
				{tab === "policies" && (
					<section className={LEVEL_PANEL_CLASS}>
						<h2 className="mb-4 text-lg font-bold">Tiêu chí và phạm vi phụ trách</h2>
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
							<output className="mt-3 text-green-800">
								Đã lưu tiêu chí. Các cấp đã duyệt không tự thay đổi.
							</output>
						)}
					</section>
				)}
				{tab === "direct" && (
					<section className={LEVEL_PANEL_CLASS}>
						<div className="mb-4 flex items-center justify-between gap-3">
							<h2 className="text-lg font-bold">Năng lực người hỗ trợ theo tuyến</h2>
							<Button variant="outline" onClick={() => void state.qualifications.refetch()}>
								Làm mới
							</Button>
						</div>
						<form
							className="mb-4 flex flex-wrap items-center gap-3 border-b border-[#e0ebe0] pb-4"
							onSubmit={(event) => {
								event.preventDefault();
								setPage(1);
								setSearch(searchInput.trim());
							}}
						>
							<label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-[#dfe8df] px-3 py-2.5">
								<Search aria-hidden="true" className="size-4 text-[#788c7e]" />
								<span className="sr-only">Tìm người hỗ trợ hoặc tuyến</span>
								<input
									value={searchInput}
									maxLength={100}
									onChange={(event) => setSearchInput(event.target.value)}
									placeholder="Tên người hỗ trợ hoặc tuyến"
									className="w-full bg-transparent text-sm outline-none"
								/>
							</label>
							<Button type="submit">Tìm kiếm</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setSearchInput("");
									setSearch("");
									setPage(1);
								}}
							>
								<RotateCcw aria-hidden="true" className="mr-2 size-4" />
								Đặt lại
							</Button>
						</form>

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
								const selected = state.qualifications.data?.items.find(
									(item) => item.id === qualificationId
								);
								if (selected) setLevel(selected.proficiency);
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
				title="Xét cấp người hỗ trợ theo tuyến"
				size="xl"
				isCloseDisabled={state.decide.isPending}
			>
				<div className="space-y-5">
					<label className="block text-sm font-semibold">
						Cấp đề xuất
						<SelectField
							label="Cấp đề xuất"
							value={level}
							disabled={state.decide.isPending}
							onChange={(value) => chooseLevel(value as PorterLevel)}
							options={LEVEL_CODES.map((code) => ({
								value: code,
								label: levelName(code, state.policies.data),
							}))}
						/>
					</label>
					{state.comparison.isPending && <output>Đang đối chiếu hồ sơ…</output>}
					{state.comparison.isError && (
						<p role="alert">
							{levelReviewError(state.comparison.error)}{" "}
							<Button onClick={() => void state.comparison.refetch()}>Thử lại</Button>
						</p>
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
