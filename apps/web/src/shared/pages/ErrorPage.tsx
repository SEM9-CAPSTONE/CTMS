import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import type React from "react";
import { Button } from "../components/Button";

export interface ErrorPageProps {
	error?: Error | string;
	resetErrorBoundary?: () => void;
	onBackToHome?: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
	error,
	resetErrorBoundary,
	onBackToHome,
}) => {
	const errorMessage = typeof error === "string" ? error : error?.message;

	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center font-sans">
			<div className="flex size-20 items-center justify-center rounded-3xl bg-red-50 text-red-600 shadow-md">
				<AlertTriangle className="size-10" />
			</div>

			<span className="mt-6 rounded-full bg-red-100 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-red-800">
				500 - Lỗi hệ thống
			</span>

			<h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#10221b] sm:text-4xl">
				Đã xảy ra sự cố hệ thống
			</h1>

			<p className="mt-2.5 max-w-md text-sm text-[#54655a]">
				Hệ thống phát hiện lỗi không mong muốn trong quá trình xử lý tác vụ của bạn.
			</p>

			{errorMessage && (
				<div className="mt-4 max-w-lg rounded-xl border border-red-200 bg-red-50/70 p-3 text-left font-mono text-xs text-red-800 overflow-x-auto">
					{errorMessage}
				</div>
			)}

			<div className="mt-8 flex flex-wrap justify-center gap-3.5">
				<Button onClick={resetErrorBoundary ?? (() => window.location.reload())} className="gap-2">
					<RefreshCw size={16} />
					<span>Thử lại</span>
				</Button>

				<Button
					variant="outline"
					onClick={
						onBackToHome ??
						(() => {
							window.location.href = "/";
						})
					}
					className="gap-2"
				>
					<Home size={16} />
					<span>Về trang chủ</span>
				</Button>
			</div>
		</div>
	);
};
