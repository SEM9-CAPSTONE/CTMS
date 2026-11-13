import { Copy, ExternalLink, IdCard } from "lucide-react";
import { useState } from "react";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components";
import { GUIDE_CARD_TYPE_LABELS } from "../../porter-verification/constants";
import type { AdminPorterVerificationDetail } from "../types";

/** Official tour-guide registry (Cục Du lịch Quốc gia Việt Nam), searched by the Admin by hand. */
export const OFFICIAL_GUIDE_REGISTRY_URL = "https://huongdanvien.vn/index.php/guide/cat/05";

const LABELS: Record<string, { text: string; tone: StatusBadgeTone }> = {
	CARD_EXPIRED: { text: "Thẻ hết hạn (theo ảnh)", tone: "danger" },
	CARD_TYPE_SITE_ONLY: { text: "Thẻ tại điểm", tone: "danger" },
	CARD_NOT_READ: { text: "Không đọc được ảnh thẻ", tone: "warning" },
	NAME_MISMATCH: { text: "Họ tên không khớp", tone: "warning" },
	ACCOUNT_NAME_MISSING: { text: "Tài khoản chưa có họ tên", tone: "warning" },
	NUMBER_MISMATCH: { text: "Số thẻ không khớp", tone: "warning" },
	TYPE_MISMATCH: { text: "Loại thẻ không khớp", tone: "warning" },
	EXPIRY_MISMATCH: { text: "Ngày hết hạn không khớp", tone: "warning" },
};

const cardTypeText = (value: string | null | undefined) =>
	value === "noi_dia" || value === "quoc_te"
		? GUIDE_CARD_TYPE_LABELS[value]
		: value === "tai_diem"
			? "Tại điểm"
			: "—";
const dateText = (value: string | null | undefined) =>
	value ? value.split("-").reverse().join("/") : "—";

export interface GuideCardReviewProps {
	detail: AdminPorterVerificationDetail;
	/** Only while the verification can be approved. */
	canConfirm: boolean;
	registryConfirmed: boolean;
	onRegistryConfirmedChange: (value: boolean) => void;
}

/**
 * Declared card vs what the system read on the photo, its labels, and the Admin's own check on the
 * official registry, which is required before approving (bug-list item #4).
 */
export function GuideCardReview({
	detail,
	canConfirm,
	registryConfirmed,
	onRegistryConfirmedChange,
}: GuideCardReviewProps) {
	const [copied, setCopied] = useState(false);
	const card = detail.guideCard;
	const check = detail.cardCheck;
	const reading = check?.reading ?? null;

	const copyNumber = async () => {
		if (!card) return;
		try {
			await navigator.clipboard.writeText(card.cardNumber);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<section
			aria-label="Thẻ hướng dẫn viên"
			className="space-y-3 rounded-xl border border-[#e0ebe0] p-4"
		>
			<div className="flex flex-wrap items-center gap-2">
				<IdCard className="size-4 text-[#164027]" />
				<h3 className="text-sm font-extrabold">Thẻ hướng dẫn viên</h3>
				{check && check.labels.length === 0 && (
					<StatusBadge tone="success">Ảnh thẻ khớp thông tin khai</StatusBadge>
				)}
				{check?.labels.map((label) => (
					<StatusBadge key={label} tone={LABELS[label]?.tone ?? "warning"}>
						{LABELS[label]?.text ?? label}
					</StatusBadge>
				))}
			</div>

			{!card ? (
				<p className="text-sm text-[#667a6d]">
					Porter chưa khai báo thẻ (hồ sơ được duyệt trước khi áp dụng thẻ hướng dẫn viên).
				</p>
			) : (
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="text-xs font-bold text-[#667a6d]">
							<th className="py-1 pr-2 font-bold"> </th>
							<th className="py-1 pr-2 font-bold">Porter khai</th>
							<th className="py-1 font-bold">Hệ thống đọc từ ảnh</th>
						</tr>
					</thead>
					<tbody className="font-semibold text-[#10221b]">
						<tr>
							<td className="py-1 pr-2 text-xs font-bold text-[#667a6d]">Họ tên</td>
							<td className="py-1 pr-2">{detail.fullName ?? "—"}</td>
							<td className="py-1">{reading?.fullName ?? "—"}</td>
						</tr>
						<tr>
							<td className="py-1 pr-2 text-xs font-bold text-[#667a6d]">Loại thẻ</td>
							<td className="py-1 pr-2">{cardTypeText(card.cardType)}</td>
							<td className="py-1">{cardTypeText(reading?.cardType)}</td>
						</tr>
						<tr>
							<td className="py-1 pr-2 text-xs font-bold text-[#667a6d]">Số thẻ</td>
							<td className="py-1 pr-2" data-testid="declared-card-number">
								{card.cardNumber}
							</td>
							<td className="py-1">{reading?.cardNumber ?? "—"}</td>
						</tr>
						<tr>
							<td className="py-1 pr-2 text-xs font-bold text-[#667a6d]">Có giá trị đến</td>
							<td className="py-1 pr-2">{dateText(card.expiresOn)}</td>
							<td className="py-1">{dateText(reading?.expiresOn)}</td>
						</tr>
					</tbody>
				</table>
			)}

			{card && (
				<div className="space-y-2 rounded-lg bg-[#f7faf6] p-3 text-xs text-[#2b4135]">
					<p className="font-medium">
						Hệ thống chỉ đọc chữ trên ảnh, không biết thẻ thật hay giả. Hãy tra số thẻ trên trang
						chính thức và đối chiếu họ tên, loại thẻ, ngày hết hạn trước khi duyệt.
					</p>
					<div className="flex flex-wrap gap-2">
						<a
							href={OFFICIAL_GUIDE_REGISTRY_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8df] bg-white px-3 py-1.5 font-bold text-[#164027] hover:bg-[#f1f5f0]"
						>
							<ExternalLink className="size-3.5" /> Mở huongdanvien.vn
						</a>
						<button
							type="button"
							onClick={() => void copyNumber()}
							className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8df] bg-white px-3 py-1.5 font-bold text-[#164027] hover:bg-[#f1f5f0]"
						>
							<Copy className="size-3.5" /> {copied ? "Đã sao chép số thẻ" : "Sao chép số thẻ"}
						</button>
					</div>
					{canConfirm ? (
						<label className="flex items-start gap-2 font-bold text-[#10221b]">
							<input
								type="checkbox"
								checked={registryConfirmed}
								onChange={(event) => onRegistryConfirmedChange(event.target.checked)}
								className="mt-0.5"
							/>
							Tôi đã tra số thẻ trên huongdanvien.vn và thông tin khớp với Porter.
						</label>
					) : (
						detail.registryCheckedAt && (
							<p className="font-bold text-emerald-700">
								Admin đã đối chiếu nguồn chính thức lúc{" "}
								{new Date(detail.registryCheckedAt).toLocaleString("vi-VN")}.
							</p>
						)
					)}
				</div>
			)}
		</section>
	);
}
