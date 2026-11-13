import { IdCard, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "../../../shared/components";
import { GUIDE_CARD_TYPE_LABELS, validateGuideCard, vietnamToday } from "../constants";
import type { GuideCard, GuideCardType } from "../types";

export interface GuideCardFormProps {
	card: GuideCard | null;
	isEditable: boolean;
	isSaving: boolean;
	onSave: (card: GuideCard) => Promise<boolean>;
}

/**
 * The Porter's tour-guide card (bug-list item #4): domestic or international only, 9-digit number
 * and the "valid through" date. The card photo itself is uploaded with the documents below.
 */
export function GuideCardForm({ card, isEditable, isSaving, onSave }: GuideCardFormProps) {
	const [cardType, setCardType] = useState<GuideCardType>(card?.cardType ?? "noi_dia");
	const [cardNumber, setCardNumber] = useState(card?.cardNumber ?? "");
	const [expiresOn, setExpiresOn] = useState(card?.expiresOn ?? "");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setCardType(card?.cardType ?? "noi_dia");
		setCardNumber(card?.cardNumber ?? "");
		setExpiresOn(card?.expiresOn ?? "");
	}, [card]);

	const dirty =
		!card ||
		card.cardType !== cardType ||
		card.cardNumber !== cardNumber ||
		card.expiresOn !== expiresOn;

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const next = { cardType, cardNumber: cardNumber.trim(), expiresOn };
		const problem = validateGuideCard(next);
		setError(problem);
		if (!problem) await onSave(next);
	};

	return (
		<section
			aria-label="Thông tin thẻ hướng dẫn viên"
			className="space-y-3 rounded-2xl border border-[#dfe8df] p-4"
		>
			<div className="flex items-center gap-2">
				<IdCard className="size-4 text-[#164027]" />
				<h2 className="text-sm font-extrabold">Thẻ hướng dẫn viên du lịch</h2>
				{card && !dirty && <span className="text-xs font-bold text-emerald-700">Đã lưu</span>}
			</div>
			<p className="text-xs font-medium text-[#667a6d]">
				Chỉ nhận thẻ nội địa hoặc quốc tế (không nhận thẻ tại điểm). Nhập đúng như in trên thẻ, rồi
				tải ảnh mặt trước của thẻ ở phần tài liệu bên dưới để hệ thống đối chiếu.
			</p>
			<form
				noValidate
				className="grid grid-cols-1 gap-3 sm:grid-cols-3"
				onSubmit={(event) => void submit(event)}
			>
				<label className="space-y-1 text-xs font-bold text-[#2b4135]">
					<span>Loại thẻ</span>
					<select
						aria-label="Loại thẻ"
						value={cardType}
						disabled={!isEditable || isSaving}
						onChange={(event) => setCardType(event.target.value as GuideCardType)}
						className="w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm font-medium outline-none focus:border-[#164027]"
					>
						{(Object.keys(GUIDE_CARD_TYPE_LABELS) as GuideCardType[]).map((type) => (
							<option key={type} value={type}>
								{GUIDE_CARD_TYPE_LABELS[type]}
							</option>
						))}
					</select>
				</label>
				<label className="space-y-1 text-xs font-bold text-[#2b4135]">
					<span>Số thẻ (9 chữ số)</span>
					<input
						aria-label="Số thẻ"
						inputMode="numeric"
						maxLength={9}
						value={cardNumber}
						disabled={!isEditable || isSaving}
						onChange={(event) => setCardNumber(event.target.value.replace(/\D/g, ""))}
						className="w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm font-medium outline-none focus:border-[#164027]"
					/>
				</label>
				<label className="space-y-1 text-xs font-bold text-[#2b4135]">
					<span>Có giá trị đến</span>
					<input
						aria-label="Có giá trị đến"
						type="date"
						min={vietnamToday()}
						value={expiresOn}
						disabled={!isEditable || isSaving}
						onChange={(event) => setExpiresOn(event.target.value)}
						className="w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm font-medium outline-none focus:border-[#164027]"
					/>
				</label>
				{isEditable && (
					<div className="flex items-center justify-between gap-3 sm:col-span-3">
						<p role={error ? "alert" : undefined} className="text-xs font-bold text-red-700">
							{error}
						</p>
						<Button type="submit" size="sm" variant="outline" disabled={!dirty || isSaving}>
							{isSaving && <Loader2 className="mr-1 inline size-4 animate-spin" />}
							Lưu thông tin thẻ
						</Button>
					</div>
				)}
			</form>
		</section>
	);
}
