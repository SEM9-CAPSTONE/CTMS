import { useEffect, useState } from "react";
import { HttpError } from "../core/api";
import { clearAuthSessionAndRedirect } from "../core/api/authSessionSync";
import { AdminUserAccountsPage } from "../features/admin-user-accounts/pages/AdminUserAccountsPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { VerifyOtpPage } from "../features/auth/pages/VerifyOtpPage";
import { authService } from "../features/auth/services/auth.service";
import { getGrantedRoles, isAdminUser } from "../features/auth/utils/permissions";
import { getRefreshToken, getStoredAuthUser } from "../features/auth/utils/tokenStorage";
import { CamperProfilePage } from "../features/camper-profile/pages/CamperProfilePage";
import { LandingPage } from "../features/landing/pages/LandingPage";
import { RoleLandingPage } from "../features/role-landing/pages/RoleLandingPage";
import { EdgeCasePage, ErrorPage, NotFoundPage, UnauthorizedPage } from "../shared/pages";
import { AppRoleGuard } from "./AppRoleGuard";
import { RoutePath } from "./routes.config";

export function AppRoutes() {
	const [currentPath, setCurrentPath] = useState<string>(() => {
		// Also support legacy hash redirect if user enters with #
		if (window.location.hash) {
			const hashPath = window.location.hash.replace("#", "/");
			window.history.replaceState({}, "", hashPath);
			return hashPath.toLowerCase();
		}
		return window.location.pathname.toLowerCase();
	});

	useEffect(() => {
		const handleLocationChange = () => {
			setCurrentPath(window.location.pathname.toLowerCase());
		};

		window.addEventListener("popstate", handleLocationChange);
		return () => {
			window.removeEventListener("popstate", handleLocationChange);
		};
	}, []);

	const navigateTo = (path: string) => {
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		window.history.pushState({}, "", normalizedPath);
		setCurrentPath(normalizedPath.toLowerCase());
	};

	const handleLogout = async (allDevices = false) => {
		const refreshToken = getRefreshToken();

		if (!refreshToken) {
			clearAuthSessionAndRedirect();
			return;
		}

		try {
			await authService.logout({
				refreshToken,
				allDevices,
			});

			clearAuthSessionAndRedirect();
		} catch (error) {
			if (error instanceof HttpError && error.status === 401) {
				clearAuthSessionAndRedirect();
				return;
			}

			throw error;
		}
	};

	const storedUser = getStoredAuthUser();
	const currentRoles = getGrantedRoles(storedUser);
	const unauthorizedFallback = (
		<UnauthorizedPage
			requiredRole="admin"
			onBackToHome={() => navigateTo(RoutePath.HOME)}
			onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
		/>
	);

	useEffect(() => {
		const isHomePath = currentPath === RoutePath.HOME || currentPath === "";
		if (isHomePath && storedUser && currentRoles.length > 0) {
			window.history.replaceState({}, "", RoutePath.DASHBOARD);
			setCurrentPath(RoutePath.DASHBOARD);
		}
	}, [currentPath, currentRoles.length, storedUser]);

	switch (currentPath) {
		case RoutePath.HOME:
		case "":
			return (
				<LandingPage
					onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
					onNavigateToRegister={() => navigateTo(RoutePath.REGISTER)}
				/>
			);

		case RoutePath.LOGIN:
			return (
				<LoginPage
					onBackToHome={() => navigateTo(RoutePath.HOME)}
					onNavigateToRegister={() => navigateTo(RoutePath.REGISTER)}
					onNavigateToForgotPassword={() => navigateTo(RoutePath.FORGOT_PASSWORD)}
					onLoginSuccess={(user) => {
						navigateTo(isAdminUser(user) ? RoutePath.ADMIN_USERS : RoutePath.DASHBOARD);
					}}
				/>
			);

		case RoutePath.FORGOT_PASSWORD:
			return (
				<ForgotPasswordPage
					onBackToHome={() => navigateTo(RoutePath.HOME)}
					onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
				/>
			);

		case RoutePath.REGISTER:
			return (
				<RegisterPage
					onBackToHome={() => navigateTo(RoutePath.HOME)}
					onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
					onNavigateToVerifyOtp={() => navigateTo(RoutePath.VERIFY_OTP)}
				/>
			);

		case RoutePath.VERIFY_OTP:
			return (
				<VerifyOtpPage
					onBackToHome={() => navigateTo(RoutePath.HOME)}
					onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
					onNavigateToRegister={() => navigateTo(RoutePath.REGISTER)}
				/>
			);

		case RoutePath.CAMPER_PROFILE:
		case RoutePath.PROFILE:
			return (
				<CamperProfilePage
					onBackHome={() => navigateTo(RoutePath.HOME)}
					onNavigateDashboard={() => navigateTo(RoutePath.DASHBOARD)}
					onLogout={handleLogout}
				/>
			);

		case RoutePath.DASHBOARD:
			return (
				<AppRoleGuard
					allowedRoles={["camper", "host", "porter", "admin"]}
					currentRoles={currentRoles}
					fallback={
						<UnauthorizedPage
							onBackToHome={() => navigateTo(RoutePath.HOME)}
							onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
						/>
					}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					{storedUser ? (
						<RoleLandingPage
							user={storedUser}
							roles={currentRoles}
							onBackHome={() => navigateTo(RoutePath.HOME)}
							onOpenProfile={() => navigateTo(RoutePath.PROFILE)}
							onOpenAdminUsers={() => navigateTo(RoutePath.ADMIN_USERS)}
							onLogout={handleLogout}
						/>
					) : (
						unauthorizedFallback
					)}
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_USERS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminUserAccountsPage onBackHome={() => navigateTo(RoutePath.HOME)} />
				</AppRoleGuard>
			);

		case RoutePath.UNAUTHORIZED:
			return (
				<UnauthorizedPage
					onBackToHome={() => navigateTo(RoutePath.HOME)}
					onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
				/>
			);

		case RoutePath.ERROR:
			return <ErrorPage onBackToHome={() => navigateTo(RoutePath.HOME)} />;

		case RoutePath.OFFLINE:
			return <EdgeCasePage onRetryConnection={() => window.location.reload()} />;

		default:
			return <NotFoundPage onBackToHome={() => navigateTo(RoutePath.HOME)} />;
	}
}
