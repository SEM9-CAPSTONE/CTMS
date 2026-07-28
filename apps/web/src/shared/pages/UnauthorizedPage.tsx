import { ArrowLeft, Home, ShieldAlert } from "lucide-react";
import type React from "react";
import { Button } from "../components/Button";

export interface UnauthorizedPageProps {
	requiredRole?: string;
	onBackToHome?: () => void;
	onNavigateToLogin?: () => void;
}

export const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({
	requiredRole,
	onBackToHome,
	onNavigateToLogin,
}) => {
	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center font-sans">
			<div className="flex size-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-700 shadow-md">
				<ShieldAlert className="size-10" />
			</div>

			<span className="mt-6 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-800">
				403 - Hạn chế quyền truy cập
			</span>

			<h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#10221b] sm:text-4xl">
				Không có quyền truy cập
			</h1>

			<p className="mt-2.5 max-w-md text-sm text-[#54655a]">
				Tài khoản của bạn hiện tại không có quyền hạn để xem trang này.
				{requiredRole && (
					<span>
						{" "}
						Trang này yêu cầu vai trò:{" "}
						<strong className="uppercase text-[#164027]">{requiredRole}</strong>.
					</span>
				)}
			</p>

			<div className="mt-8 flex flex-wrap justify-center gap-3.5">
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

				{onNavigateToLogin && (
					<Button onClick={onNavigateToLogin} className="gap-2">
						<ArrowLeft size={16} />
						<span>Đăng nhập tài khoản khác</span>
					</Button>
				)}
			</div>
		</div>
	);
};
