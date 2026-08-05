import { HeartPulse, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { MedicalConditionItem } from "../types";

interface MedicalConditionsListProps {
	conditions: MedicalConditionItem[];
	onAddCondition: (item: MedicalConditionItem) => void;
	onRemoveCondition: (id: string) => void;
	disabled?: boolean;
}

export function MedicalConditionsList({
	conditions,
	onAddCondition,
	onRemoveCondition,
	disabled,
}: MedicalConditionsListProps) {
	const [name, setName] = useState("");
	const [medication, setMedication] = useState("");
	const [notes, setNotes] = useState("");

	const handleAdd = () => {
		if (!name.trim()) return;
		const newItem: MedicalConditionItem = {
			id: `med-${Date.now()}`,
			name: name.trim(),
			medication: medication.trim() || undefined,
			notes: notes.trim() || undefined,
		};
		onAddCondition(newItem);
		setName("");
		setMedication("");
		setNotes("");
	};

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="flex items-center justify-between border-b border-[#f0f4f1] pb-3">
				<div>
					<h3 className="text-base font-extrabold text-[#164027] flex items-center gap-2">
						<HeartPulse size={18} className="text-rose-600" />
						<span>Bệnh lý mạn tính & Thuốc điều trị</span>
					</h3>
					<p className="text-xs font-medium text-[#627769]">
						Khai báo các bệnh mạn tính (hen suyễn, tim mạch, khớp...) và thuốc cá nhân cần sử dụng.
					</p>
				</div>
				<span className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-bold text-[#164027]">
					{conditions.length} mục
				</span>
			</div>

			{/* Existing Conditions List */}
			{conditions.length === 0 ? (
				<div className="rounded-xl border border-dashed border-[#dfe8df] bg-[#f9fbf9] p-4 text-center text-xs font-semibold text-[#728579]">
					Chưa khai báo bệnh lý mạn tính nào.
				</div>
			) : (
				<div className="flex flex-col gap-2.5">
					{conditions.map((item) => (
						<div
							key={item.id}
							className="flex items-center justify-between gap-3 rounded-xl border border-[#dfe8df] bg-[#fcfdfe] p-3 transition hover:border-[#164027]/30"
						>
							<div className="flex flex-col gap-0.5">
								<span className="font-bold text-xs text-[#10221b]">{item.name}</span>
								{item.medication && (
									<span className="text-xs text-[#164027] font-semibold">
										Thuốc cá nhân: {item.medication}
									</span>
								)}
								{item.notes && <span className="text-xs text-[#627769] italic">{item.notes}</span>}
							</div>
							{!disabled && (
								<button
									type="button"
									onClick={() => onRemoveCondition(item.id)}
									className="rounded-lg p-1 text-[#889b8f] hover:bg-red-50 hover:text-red-600 transition shrink-0"
									title="Xóa mục bệnh lý"
								>
									<Trash2 size={15} />
								</button>
							)}
						</div>
					))}
				</div>
			)}

			{/* Add Condition Input Row */}
			{!disabled && (
				<div className="mt-2 flex flex-col sm:flex-row items-center gap-2 rounded-xl border border-[#dfe8df] bg-[#f8faf8] p-3">
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Tên bệnh lý (ví dụ: Hen suyễn)"
						className="h-9 flex-1 rounded-xl border border-[#dfe8df] bg-white px-3 text-xs text-[#10221b] outline-none focus:border-[#164027]"
					/>
					<input
						type="text"
						value={medication}
						onChange={(e) => setMedication(e.target.value)}
						placeholder="Tên thuốc cá nhân mang theo"
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
