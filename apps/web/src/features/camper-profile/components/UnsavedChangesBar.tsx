import { AlertCircle, Loader2, Save, Undo2 } from "lucide-react";

interface UnsavedChangesBarProps {
	isVisible: boolean;
	isSaving: boolean;
	onSave: () => void;
	onReset: () => void;
}

export function UnsavedChangesBar({
	isVisible,
	isSaving,
	onSave,
	onReset,
}: UnsavedChangesBarProps) {
	if (!isVisible) return null;

	return (
		<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex w-11/12 max-w-2xl items-center justify-between gap-4 rounded-2xl border border-[#164027]/20 bg-[#164027] p-4 text-white shadow-2xl backdrop-blur-lg animate-in fade-in slide-in-from-bottom-5 duration-300">
			<div className="flex items-center gap-2.5">
				<span className="relative flex size-3">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
					<span className="relative inline-flex size-3 rounded-full bg-amber-500" />
				</span>
				<div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
					<AlertCircle size={16} className="text-amber-400" />
					<span>Bạn có thay đổi chưa được lưu</span>
				</div>
			</div>

			<div className="flex items-center gap-2.5">
				<button
					type="button"
					onClick={onReset}
					disabled={isSaving}
					className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition disabled:opacity-50"
				>
					<Undo2 size={13} />
					<span>Hủy thay đổi</span>
				</button>

				<button
					type="button"
					onClick={onSave}
					disabled={isSaving}
					className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-600 transition disabled:opacity-50"
				>
					{isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
					<span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
				</button>
			</div>
		</div>
	);
}
