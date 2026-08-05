import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AllergyItem, AllergySeverity } from "../types";

interface AllergiesListProps {
	allergies: AllergyItem[];
	onAddAllergy: (item: AllergyItem) => void;
	onRemoveAllergy: (id: string) => void;
	disabled?: boolean;
}

const severityConfig: Record<
	AllergySeverity,
	{ label: string; bg: string; text: string; border: string }
> = {
	LOW: { label: "Nhẹ", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
	MEDIUM: { label: "Vừa", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
	HIGH: { label: "Nặng", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
	CRITICAL: { label: "Nguy hiểm", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

export function AllergiesList({
	allergies,
	onAddAllergy,
	onRemoveAllergy,
	disabled,
}: AllergiesListProps) {
	const [name, setName] = useState("");
	const [severity, setSeverity] = useState<AllergySeverity>("MEDIUM");
	const [reaction, setReaction] = useState("");

	const handleAdd = () => {
		if (!name.trim()) return;
		const newItem: AllergyItem = {
			id: `alg-${Date.now()}`,
			name: name.trim(),
			severity,
			reaction: reaction.trim() || undefined,
		};
		onAddAllergy(newItem);
		setName("");
		setReaction("");
		setSeverity("MEDIUM");
	};

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="flex items-center justify-between border-b border-[#f0f4f1] pb-3">
				<div>
					<h3 className="text-base font-extrabold text-[#164027] flex items-center gap-2">
						<AlertTriangle size={18} className="text-amber-600" />
						<span>Tiền sử dị ứng</span>
					</h3>
					<p className="text-xs font-medium text-[#627769]">
						Khai báo thực phẩm, dị vật hoặc thuốc gây dị ứng để Porter tránh chuẩn bị trong chuyến
						đi.
					</p>
				</div>
				<span className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-bold text-[#164027]">
					{allergies.length} dị ứng
				</span>
			</div>

			{/* Existing Allergies List */}
			{allergies.length === 0 ? (
				<div className="rounded-xl border border-dashed border-[#dfe8df] bg-[#f9fbf9] p-4 text-center text-xs font-semibold text-[#728579]">
					Chưa khai báo dị ứng nào.
				</div>
			) : (
				<div className="flex flex-col gap-2.5">
					{allergies.map((item) => {
						const sev = severityConfig[item.severity] || severityConfig.MEDIUM;
						return (
							<div
								key={item.id}
								className="flex items-center justify-between gap-3 rounded-xl border border-[#dfe8df] bg-[#fcfdfe] p-3 transition hover:border-[#164027]/30"
							>
								<div className="flex flex-wrap items-center gap-2.5">
									<span className="font-bold text-xs text-[#10221b]">{item.name}</span>
									<span
										className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${sev.bg} ${sev.text} ${sev.border}`}
									>
										{sev.label}
									</span>
									{item.reaction && (
										<span className="text-xs text-[#5d7365] italic">({item.reaction})</span>
									)}
								</div>
								{!disabled && (
									<button
										type="button"
										onClick={() => onRemoveAllergy(item.id)}
										className="rounded-lg p-1 text-[#889b8f] hover:bg-red-50 hover:text-red-600 transition"
										title="Xóa dị ứng"
									>
										<Trash2 size={15} />
									</button>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Add Allergy Input Row */}
			{!disabled && (
				<div className="mt-2 flex flex-col sm:flex-row items-center gap-2 rounded-xl border border-[#dfe8df] bg-[#f8faf8] p-3">
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Tên dị ứng (ví dụ: Penicillin)"
						className="h-9 flex-1 rounded-xl border border-[#dfe8df] bg-white px-3 text-xs text-[#10221b] outline-none focus:border-[#164027]"
					/>
					<select
						value={severity}
						onChange={(e) => setSeverity(e.target.value as AllergySeverity)}
						className="h-9 rounded-xl border border-[#dfe8df] bg-white px-2.5 text-xs font-semibold text-[#10221b] outline-none focus:border-[#164027]"
					>
						<option value="LOW">Nhẹ</option>
						<option value="MEDIUM">Vừa</option>
						<option value="HIGH">Nặng</option>
						<option value="CRITICAL">Nguy hiểm</option>
					</select>
					<input
						type="text"
						value={reaction}
						onChange={(e) => setReaction(e.target.value)}
						placeholder="Triệu chứng (tùy chọn)"
						className="h-9 flex-1 rounded-xl border border-[#dfe8df] bg-white px-3 text-xs text-[#10221b] outline-none focus:border-[#164027]"
					/>
					<button
						type="button"
						onClick={handleAdd}
						className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-[#164027] px-3.5 text-xs font-bold text-white hover:bg-[#276143] transition shrink-0"
					>
						<Plus size={14} />
						<span>Thêm</span>
					</button>
				</div>
			)}
		</div>
	);
}
