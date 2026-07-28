import { Compass, RefreshCw, Shield, WifiOff } from "lucide-react";
import type React from "react";
import { Button } from "../components/Button";

export interface EdgeCasePageProps {
	title?: string;
	description?: string;
	onRetryConnection?: () => void;
	onOpenOfflineGuide?: () => void;
}

export const EdgeCasePage: React.FC<EdgeCasePageProps> = ({
	title = "Đang ở chế độ Ngoại tuyến (Offline)",
	description = "Kết nối mạng internet bị gián đoạn hoặc không có sóng. CTMS đã tự động chuyển sang chế độ lưu trữ ngoại tuyến.",
	onRetryConnection,
	onOpenOfflineGuide,
}) => {
	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center font-sans">
			<div className="flex size-20 items-center justify-center rounded-3xl bg-emerald-900/10 text-[#164027] shadow-md backdrop-blur-md">
				<WifiOff className="size-10" />
			</div>

			<span className="mt-6 rounded-full bg-[#eef7f0] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#164027]">
				Offline Mode Active
			</span>

			<h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#10221b] sm:text-4xl">
				{title}
			</h1>

			<p className="mt-2.5 max-w-md text-sm text-[#54655a]">{description}</p>

			{/* Offline Features Enabled */}
			<div className="mt-6 grid max-w-md grid-cols-1 gap-2.5 sm:grid-cols-2 text-left">
				<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white p-3 text-xs font-bold text-[#164027]">
					<Compass size={18} className="text-[#276143]" />
					<span>Bản đồ Offline sẵn sàng</span>
				</div>
				<div className="flex items-center gap-2.5 rounded-xl border border-[#dfe8df] bg-white p-3 text-xs font-bold text-[#164027]">
					<Shield size={18} className="text-[#276143]" />
					<span>AI Trợ lý Sinh tồn Cực bộ</span>
				</div>
			</div>

			<div className="mt-8 flex flex-wrap justify-center gap-3.5">
				<Button onClick={onRetryConnection ?? (() => window.location.reload())} className="gap-2">
					<RefreshCw size={16} />
					<span>Kiểm tra lại kết nối</span>
				</Button>

				{onOpenOfflineGuide && (
					<Button variant="outline" onClick={onOpenOfflineGuide} className="gap-2">
						<Compass size={16} />
						<span>Mở Cẩm nang Ngoại tuyến</span>
					</Button>
				)}
			</div>
		</div>
	);
};
