import { useEffect, useState } from "react";
import { HttpError } from "../core/api";
import { clearAuthSessionAndRedirect } from "../core/api/authSessionSync";
import { AdminAuditLogsPage } from "../features/admin-audit-logs/pages/AdminAuditLogsPage";
import { AdminUserAccountsPage } from "../features/admin-user-accounts/pages/AdminUserAccountsPage";
import { AdminWeatherRulesPage } from "../features/admin-weather-rules/pages/AdminWeatherRulesPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { VerifyOtpPage } from "../features/auth/pages/VerifyOtpPage";
import { authService } from "../features/auth/services/auth.service";
import { getGrantedRoles, isAdminUser } from "../features/auth/utils/permissions";
import { getRefreshToken, getStoredAuthUser } from "../features/auth/utils/tokenStorage";
import { CamperProfilePage } from "../features/camper-profile/pages/CamperProfilePage";
import { AdminCampsitesPage } from "../features/campsites/pages/AdminCampsitesPage";
import { CampsiteDetailPage } from "../features/campsites/pages/CampsiteDetailPage";
import { CampsiteFormPage } from "../features/campsites/pages/CampsiteFormPage";
import { SearchCampsitesPage } from "../features/campsites/pages/SearchCampsitesPage";
import { LandingPage } from "../features/landing/pages/LandingPage";
import { HostLayout } from "../features/role-landing/components/HostLayout";
import { RoleLandingPage } from "../features/role-landing/pages/RoleLandingPage";
import { AdminTrekkingRoutesPage } from "../features/trekking-routes/pages/AdminTrekkingRoutesPage";
import { CreateTrekkingRoutePage } from "../features/trekking-routes/pages/CreateTrekkingRoutePage";
import { TrekkingRoutesPage } from "../features/trekking-routes/pages/TrekkingRoutesPage";
import { EdgeCasePage, ErrorPage, NotFoundPage, UnauthorizedPage } from "../shared/pages";
import { AppRoleGuard } from "./AppRoleGuard";
import { RoutePath } from "./routes.config";

export function AppRoutes() {
	const [currentPath, setCurrentPath] = useState<string>(() => {
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
		setCurrentPath(new URL(normalizedPath, window.location.origin).pathname.toLowerCase());
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
	const editCampsiteMatch = currentPath.match(
		/^\/host\/campsites\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/edit$/i
	);

	if (editCampsiteMatch) {
		return (
			<AppRoleGuard
				allowedRoles={["host"]}
				currentRoles={currentRoles}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				<HostLayout onLogout={handleLogout}>
					<CampsiteFormPage
						mode="edit"
						campsiteId={editCampsiteMatch[1]}
						onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
					/>
				</HostLayout>
			</AppRoleGuard>
		);
	}

	const campsiteDetailMatch = currentPath.match(
		/^\/campsites\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
	);

	if (campsiteDetailMatch) {
		return (
			<AppRoleGuard
				allowedRoles={["camper"]}
				currentRoles={currentRoles}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				<CampsiteDetailPage
					campsiteId={campsiteDetailMatch[1]}
					onBack={() => navigateTo(RoutePath.CAMPSITES)}
					onNavigateDashboard={() => navigateTo(RoutePath.DASHBOARD)}
					onNavigateProfile={() => navigateTo(RoutePath.CAMPER_PROFILE)}
					onLogout={handleLogout}
				/>
			</AppRoleGuard>
		);
	}

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
					onNavigateDashboard={() => navigateTo(RoutePath.HOME)}
					onLogout={handleLogout}
				/>
			);

		case RoutePath.CAMPSITES:
			return (
				<AppRoleGuard
					allowedRoles={["camper"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<SearchCampsitesPage
						onNavigateDashboard={() => navigateTo(RoutePath.DASHBOARD)}
						onNavigateProfile={() => navigateTo(RoutePath.CAMPER_PROFILE)}
						onLogout={handleLogout}
					/>
				</AppRoleGuard>
			);

		case RoutePath.HOST_CREATE_CAMPSITE:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout}>
						<CampsiteFormPage mode="create" onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.HOST_CREATE_TREKKING_ROUTE:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout}>
						<CreateTrekkingRoutePage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.HOST_TREKKING_ROUTES:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout}>
						<TrekkingRoutesPage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.DASHBOARD: {
			if (!storedUser || currentRoles.length === 0) {
				return (
					<UnauthorizedPage
						onBackToHome={() => navigateTo(RoutePath.HOME)}
						onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
					/>
				);
			}

			return (
				<RoleLandingPage
					user={storedUser}
					roles={currentRoles}
					onBackHome={() => navigateTo(RoutePath.HOME)}
					onOpenProfile={() => navigateTo(RoutePath.CAMPER_PROFILE)}
					onOpenAdminUsers={() => navigateTo(RoutePath.ADMIN_USERS)}
					onExplore={() => navigateTo(RoutePath.CAMPSITES)}
					onCreateCampsite={() => navigateTo(RoutePath.HOST_CREATE_CAMPSITE)}
					onCreateTrekkingRoute={(campsiteId?: string) =>
						navigateTo(
							campsiteId
								? `${RoutePath.HOST_CREATE_TREKKING_ROUTE}?campsiteId=${encodeURIComponent(campsiteId)}`
								: RoutePath.HOST_CREATE_TREKKING_ROUTE
						)
					}
					onViewTrekkingRoutes={(campsiteId: string) =>
						navigateTo(
							`${RoutePath.HOST_TREKKING_ROUTES}?campsiteId=${encodeURIComponent(campsiteId)}`
						)
					}
					onEditCampsite={(id) => navigateTo(`/host/campsites/${id}/edit`)}
					onLogout={handleLogout}
				/>
			);
		}

		case RoutePath.ADMIN_USERS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminUserAccountsPage onLogout={handleLogout} />
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_AUDIT_LOGS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminAuditLogsPage onLogout={handleLogout} />
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_CAMPSITES:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminCampsitesPage onLogout={handleLogout} />
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_TREKKING_ROUTES:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminTrekkingRoutesPage onLogout={handleLogout} />
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_WEATHER_RULES:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminWeatherRulesPage onLogout={handleLogout} />
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
