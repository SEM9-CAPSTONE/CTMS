import { Lock, ShieldAlert } from "lucide-react";
import type React from "react";
import { Button } from "../shared/components/Button";
import type { UserRole } from "../shared/types";

export interface AppRoleGuardProps {
	/** List of roles authorized to view the protected route */
	allowedRoles: UserRole[];
	/** Current active user role */
	currentRole?: UserRole | null;
	/** Content to render if authorized */
	children: React.ReactNode;
	/** Optional custom fallback component when access is denied */
	fallback?: React.ReactNode;
	/** Callback to navigate back to home or login */
	onNavigateHome?: () => void;
}

export const AppRoleGuard: React.FC<AppRoleGuardProps> = ({
	allowedRoles,
	currentRole,
	children,
	fallback,
	onNavigateHome,
}) => {
	if (!currentRole) {
		return (
			fallback ?? (
				<div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center font-sans">
					<div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm">
						<Lock className="size-8" />
					</div>
					<h2 className="mt-4 text-2xl font-extrabold text-[#10221b]">Yêu cầu đăng nhập</h2>
					<p className="mt-2 max-w-md text-sm text-[#54655a]">
						Bạn cần đăng nhập để truy cập khu vực này. Vui lòng đăng nhập tài khoản CTMS của bạn.
					</p>
					{onNavigateHome && (
						<div className="mt-6">
							<Button onClick={onNavigateHome}>Quay về trang chủ</Button>
						</div>
					)}
				</div>
			)
		);
	}

	// Normalize role comparison (case-insensitive)
	const normalizedCurrentRole = currentRole.toLowerCase();
	const isAuthorized = allowedRoles.some((role) => role.toLowerCase() === normalizedCurrentRole);

	if (!isAuthorized) {
		return (
			fallback ?? (
				<div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center font-sans">
					<div className="flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 shadow-sm">
						<ShieldAlert className="size-8" />
					</div>
					<h2 className="mt-4 text-2xl font-extrabold text-[#10221b]">Truy cập bị từ chối</h2>
					<p className="mt-2 max-w-md text-sm text-[#54655a]">
						Vai trò hiện tại của bạn (
						<span className="font-semibold uppercase text-[#164027]">{currentRole}</span>) không có
						quyền xem trang này. Khu vực này yêu cầu một trong các vai trò:{" "}
						<span className="font-semibold uppercase text-[#164027]">
							{allowedRoles.map((r) => r.toLowerCase()).join(", ")}
						</span>
						.
					</p>
					{onNavigateHome && (
						<div className="mt-6">
							<Button onClick={onNavigateHome} variant="outline">
								Quay về trang chủ
							</Button>
						</div>
					)}
				</div>
			)
		);
	}

	return <>{children}</>;
};
