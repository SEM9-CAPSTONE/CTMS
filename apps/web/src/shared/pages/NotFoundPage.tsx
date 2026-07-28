import { Home } from "lucide-react";
import type React from "react";
import { Button } from "../components/Button";

export interface NotFoundPageProps {
	onBackToHome?: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onBackToHome }) => {
	return (
		<div className="flex min-h-[65vh] flex-col items-center justify-center p-6 text-center font-sans">
			<h1 className="text-7xl font-extrabold tracking-tight text-[#164027]">404</h1>

			<span className="mt-4 rounded-full bg-[#eef7f0] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#164027]">
				Không tìm thấy đường dẫn
			</span>

			<h2 className="mt-3 text-2xl font-extrabold text-[#10221b] sm:text-3xl">
				Trang không tồn tại
			</h2>

			<p className="mt-2 max-w-md text-sm text-[#54655a]">
				Rất tiếc, địa chỉ trang bạn đang truy cập không tồn tại hoặc đã được di chuyển sang vị trí
				khác.
			</p>

			<div className="mt-8">
				<Button
					onClick={
						onBackToHome ??
						(() => {
							window.location.href = "/";
						})
					}
					className="gap-2 px-6 py-3 font-bold"
				>
					<Home size={16} />
					<span>Quay về trang chủ</span>
				</Button>
			</div>
		</div>
	);
};
