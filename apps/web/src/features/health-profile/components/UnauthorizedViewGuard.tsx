import { ShieldOff } from "lucide-react";

interface UnauthorizedViewGuardProps {
	isAuthorized: boolean;
	children: React.ReactNode;
}

export function UnauthorizedViewGuard({ isAuthorized, children }: UnauthorizedViewGuardProps) {
	if (isAuthorized) {
		return <>{children}</>;
	}

	return (
		<div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center shadow-xs">
			<div className="flex size-14 items-center justify-center rounded-2xl bg-red-100 text-red-700 mb-3">
				<ShieldOff size={28} />
			</div>
			<h3 className="font-extrabold text-base text-red-950">
				Quyền truy cập bị từ chối (BR-204 & BR-025)
			</h3>
			<p className="mt-1 text-xs font-medium text-red-800 max-w-md">
				Thông tin y tế là dữ liệu cá nhân nhạy cảm. Chỉ chính bạn hoặc Host/Porter trực thuộc Trip
				liên quan có رضایت (Consent) hợp lệ mới được xem thông tin này.
			</p>
		</div>
	);
}
