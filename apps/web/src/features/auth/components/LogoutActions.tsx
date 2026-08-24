import { LogOut } from "lucide-react";
import { useState } from "react";

interface LogoutActionsProps {
	onLogout: (allDevices: boolean) => Promise<void>;
}

export function LogoutActions({ onLogout }: LogoutActionsProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submitLogout = async () => {
		if (isLoading) return;

		setIsLoading(true);
		setError(null);

		try {
			await onLogout(false);
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
				onClick={() => void submitLogout()}
				className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe8df] bg-white py-2 text-xs font-bold text-[#4a5e51] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
			>
				<LogOut size={14} />
				<span>{isLoading ? "Đang đăng xuất..." : "Đăng xuất"}</span>
			</button>

			{error && (
				<p role="alert" className="text-xs text-red-600">
					{error}
				</p>
			)}
		</div>
	);
}
