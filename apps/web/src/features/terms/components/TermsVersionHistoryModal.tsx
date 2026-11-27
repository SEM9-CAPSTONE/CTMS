import { Calendar, History } from "lucide-react";
import type React from "react";
import { Button, Modal, StatusBadge } from "../../../shared/components";
import { formatTermsDate, formatTermsVersionLabel } from "../constants";
import { useTermsVersions } from "../hooks/useTerms";
import type { TermsVersionSummary } from "../types";

export interface TermsVersionHistoryModalProps {
	isOpen: boolean;
	onClose: () => void;
	selectedVersion: string;
	onSelectVersion: (version: string) => void;
}

export const TermsVersionHistoryModal: React.FC<TermsVersionHistoryModalProps> = ({
	isOpen,
	onClose,
	selectedVersion,
	onSelectVersion,
}) => {
	const { data: versions, isLoading, isError, refetch } = useTermsVersions(isOpen);

	const handleSelect = (item: TermsVersionSummary) => {
		onSelectVersion(item.version);
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Lịch sử phiên bản điều khoản"
			description="Chọn một phiên bản để xem lại toàn văn nội dung đã công bố."
			icon={<History className="size-5" />}
			size="lg"
		>
			{isLoading && (
				<div className="space-y-3 py-4">
					<div className="h-16 animate-pulse rounded-xl bg-[#f4f7f2]" />
					<div className="h-16 animate-pulse rounded-xl bg-[#f4f7f2]" />
				</div>
			)}

			{isError && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
					<p className="text-sm font-medium text-red-700">
						Không thể tải lịch sử phiên bản. Vui lòng thử lại.
					</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-3"
						onClick={() => {
							void refetch();
						}}
					>
						Thử lại
					</Button>
				</div>
			)}

			{!isLoading && !isError && versions && versions.length === 0 && (
				<p className="py-6 text-center text-sm text-[#54655a]">
					Hiện chưa có phiên bản điều khoản nào được lưu trữ.
				</p>
			)}

			{!isLoading && !isError && versions && versions.length > 0 && (
				<div className="divide-y divide-[#eef2ee]">
					{versions.map((item) => {
						const isViewing = item.version === selectedVersion;
						return (
							<div
								key={item.id}
								className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-sm font-bold text-[#10221b]">
											{formatTermsVersionLabel(item.version)}
										</span>
										<StatusBadge tone={item.isActive ? "success" : "neutral"}>
											{item.isActive ? "hiện tại" : "cũ"}
										</StatusBadge>
										{isViewing && <StatusBadge tone="info">đang xem</StatusBadge>}
									</div>
									<p className="mt-1 flex items-center gap-1.5 text-xs text-[#54655a]">
										<Calendar className="size-3.5" />
										<span>Hiệu lực: {formatTermsDate(item.effectiveDate)}</span>
									</p>
									{item.summary && (
										<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">{item.summary}</p>
									)}
								</div>

								<Button
									variant={isViewing ? "secondary" : "outline"}
									size="sm"
									onClick={() => handleSelect(item)}
								>
									{isViewing ? "Đang xem" : "Xem phiên bản"}
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</Modal>
	);
};
