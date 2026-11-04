import { useRef, useState } from "react";
import { SOURCE_BUTTON, SOURCE_INPUT } from "../constants";
import type { SourceRights } from "../types";
const checks: Array<{
	key:
		| "sourceReviewConfirmed"
		| "internalRagUseAllowed"
		| "offlineRedistributionAllowed"
		| "translationAllowed";
	label: string;
}> = [
	{ key: "sourceReviewConfirmed", label: "Đã kiểm tra nguồn và đúng phiên bản tài liệu" },
	{ key: "internalRagUseAllowed", label: "Có quyền lưu trữ và xử lý bằng AI" },
	{ key: "offlineRedistributionAllowed", label: "Có quyền phân phối ngoại tuyến" },
	{ key: "translationAllowed", label: "Có quyền dịch hoặc chuyển thể" },
];
export function SourceReviewForm({
	busy,
	onReview,
}: {
	busy: boolean;
	onReview: (decision: "approve" | "reject", reason: string, rights: SourceRights) => Promise<void>;
}) {
	const lock = useRef(false);
	const [reason, setReason] = useState("");
	const [error, setError] = useState("");
	const [rights, setRights] = useState<SourceRights>({
		rightsReviewStatus: "NOT_REVIEWED",
		sourceReviewConfirmed: false,
		internalRagUseAllowed: false,
		offlineRedistributionAllowed: false,
		translationAllowed: false,
		medicalContentReviewStatus: "NOT_REVIEWED",
		evidence: "",
	});
	async function review(decision: "approve" | "reject") {
		if (busy || lock.current) return;
		if (rights.evidence.trim().length < 10 || (decision === "reject" && !reason.trim())) {
			setError("Nhập minh chứng xét duyệt và lý do nếu từ chối.");
			return;
		}
		lock.current = true;
		setError("");
		try {
			await onReview(decision, reason, rights);
		} finally {
			lock.current = false;
		}
	}
	return (
		<fieldset disabled={busy} className="space-y-3 rounded-xl border border-[#dfe8df] p-4">
			<legend className="font-bold">Xác minh nguồn và quyền sử dụng</legend>
			<label className="block text-sm">
				Kết quả xác minh quyền
				<select
					className={SOURCE_INPUT}
					value={rights.rightsReviewStatus}
					onChange={(event) =>
						setRights({
							...rights,
							rightsReviewStatus: event.target.value as SourceRights["rightsReviewStatus"],
						})
					}
				>
					<option value="NOT_REVIEWED">Chưa xác minh</option>
					<option value="REVIEW_REQUIRED">Cần xác minh thêm</option>
					<option value="PERMITTED">Được phép theo minh chứng</option>
					<option value="RESTRICTED">Bị hạn chế</option>
				</select>
			</label>
			{checks.map((check) => (
				<label key={check.key} className="flex items-start gap-2 text-sm">
					<input
						type="checkbox"
						checked={rights[check.key]}
						onChange={(event) => setRights({ ...rights, [check.key]: event.target.checked })}
					/>
					{check.label}
				</label>
			))}
			<label className="block text-sm">
				Kiểm tra chuyên môn y tế
				<select
					className={SOURCE_INPUT}
					value={rights.medicalContentReviewStatus}
					onChange={(event) =>
						setRights({
							...rights,
							medicalContentReviewStatus: event.target
								.value as SourceRights["medicalContentReviewStatus"],
						})
					}
				>
					<option value="NOT_REVIEWED">Chưa kiểm tra</option>
					<option value="APPROVED">Đã xác nhận phù hợp</option>
					<option value="REJECTED">Không phù hợp</option>
				</select>
			</label>
			<label className="block text-sm">
				Minh chứng xét duyệt
				<textarea
					className={SOURCE_INPUT}
					value={rights.evidence}
					onChange={(event) => setRights({ ...rights, evidence: event.target.value })}
				/>
			</label>
			<label className="block text-sm">
				Lý do quyết định
				<textarea
					className={SOURCE_INPUT}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
			</label>
			{error && (
				<p role="alert" className="text-red-700">
					{error}
				</p>
			)}
			<div className="flex gap-3">
				<button type="button" className={SOURCE_BUTTON} onClick={() => void review("approve")}>
					Phê duyệt
				</button>
				<button type="button" className={SOURCE_BUTTON} onClick={() => void review("reject")}>
					Từ chối
				</button>
			</div>
		</fieldset>
	);
}
