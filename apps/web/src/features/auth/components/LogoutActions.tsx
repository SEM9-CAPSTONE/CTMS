import { LogOut } from "lucide-react";
import { useState } from "react";

interface LogoutActionsProps {
	onLogout: (allDevices: boolean) => Promise<void>;
}

export function LogoutActions({ onLogout }: LogoutActionsProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [showAllDevicesConfirm, setShowAllDevicesConfirm] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submitLogout = async (allDevices: boolean) => {
		if (isLoading) return;

		setIsLoading(true);
		setError(null);

		try {
			await onLogout(allDevices);
		} catch {
			setError("Không thể đăng xuất. Vui lòng thử lại.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-2">
			<button
				type="button"
				disabled={isLoading}
				onClick={() => void submitLogout(false)}
				className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe8df] bg-white py-2 text-xs font-bold text-[#4a5e51] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
			>
				<LogOut size={14} />
				<span>{isLoading ? "Đang đăng xuất..." : "Đăng xuất thiết bị này"}</span>
			</button>

			<button
				type="button"
				disabled={isLoading}
				onClick={() => setShowAllDevicesConfirm(true)}
				className="w-full py-1 text-xs font-semibold text-red-600 disabled:opacity-60"
			>
				Đăng xuất tất cả thiết bị
			</button>

			{showAllDevicesConfirm && (
				<dialog open aria-labelledby="logout-all-title">
					<p id="logout-all-title" className="text-sm font-bold text-[#10221b]">
						Đăng xuất khỏi tất cả thiết bị?
					</p>

					<p className="mt-1 text-xs text-[#667a6d]">
						Bạn sẽ phải đăng nhập lại trên tất cả thiết bị.
					</p>

					<div className="mt-3 flex gap-2">
						<button type="button" disabled={isLoading} onClick={() => void submitLogout(true)}>
							Xác nhận
						</button>

						<button
							type="button"
							disabled={isLoading}
							onClick={() => setShowAllDevicesConfirm(false)}
						>
							Hủy
						</button>
					</div>
				</dialog>
			)}

			{error && (
				<p role="alert" className="text-xs text-red-600">
					{error}
				</p>
			)}
		</div>
	);
}
