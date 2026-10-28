import { type ReactNode, Suspense, lazy, useCallback, useEffect, useState } from "react";
import { HttpError } from "../core/api";
import { clearAuthSessionAndRedirect } from "../core/api/authSessionSync";
import { guardedNavigation } from "../core/navigation-guard";
import { SessionCheckScreen } from "../features/auth/components/SessionCheckScreen";
import { useIdleLogout } from "../features/auth/hooks/useIdleLogout";
import { useSessionCheck } from "../features/auth/hooks/useSessionCheck";
import { authService } from "../features/auth/services/auth.service";
import { getGrantedRoles } from "../features/auth/utils/permissions";
import { getRefreshToken, getStoredAuthUser } from "../features/auth/utils/tokenStorage";
import type { BookingDetails } from "../features/booking-details/types";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { AppRoleGuard } from "./AppRoleGuard";
import { getAuthenticatedHomePath, getGuestOnlyRedirectPath } from "./authRedirect";
import { GUEST_ONLY_PATHS, RoutePath } from "./routes.config";

const AdminAuditLogsPage = lazy(() =>
	import("../features/admin-audit-logs/pages/AdminAuditLogsPage").then((module) => ({
		default: module.AdminAuditLogsPage,
	}))
);
const AdminContentReportsPage = lazy(() =>
	import("../features/admin-content-reports/pages/AdminContentReportsPage").then((module) => ({
		default: module.AdminContentReportsPage,
	}))
);
const AdminPorterLevelsPage = lazy(() =>
	import("../features/porter-levels/pages/AdminPorterLevelsPage").then((module) => ({
		default: module.AdminPorterLevelsPage,
	}))
);
const AdminPorterVerificationsPage = lazy(() =>
	import("../features/admin-porter-verifications/pages/AdminPorterVerificationsPage").then(
		(module) => ({ default: module.AdminPorterVerificationsPage })
	)
);
const AdminRefundsPage = lazy(() =>
	import("../features/admin-refunds/pages/AdminRefundsPage").then((module) => ({
		default: module.AdminRefundsPage,
	}))
);
const AdminUserAccountsPage = lazy(() =>
	import("../features/admin-user-accounts/pages/AdminUserAccountsPage").then((module) => ({
		default: module.AdminUserAccountsPage,
	}))
);
const AdminWeatherRulesPage = lazy(() =>
	import("../features/admin-weather-rules/pages/AdminWeatherRulesPage").then((module) => ({
		default: module.AdminWeatherRulesPage,
	}))
);
const ForgotPasswordPage = lazy(() =>
	import("../features/auth/pages/ForgotPasswordPage").then((module) => ({
		default: module.ForgotPasswordPage,
	}))
);
const LoginPage = lazy(() =>
	import("../features/auth/pages/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const RegisterPage = lazy(() =>
	import("../features/auth/pages/RegisterPage").then((module) => ({ default: module.RegisterPage }))
);
const VerifyOtpPage = lazy(() =>
	import("../features/auth/pages/VerifyOtpPage").then((module) => ({
		default: module.VerifyOtpPage,
	}))
);
const BookingDetailsPage = lazy(() =>
	import("../features/booking-details/pages/BookingDetailsPage").then((module) => ({
		default: module.BookingDetailsPage,
	}))
);
const BookingListPage = lazy(() =>
	import("../features/booking-list/pages/BookingListPage").then((module) => ({
		default: module.BookingListPage,
	}))
);
const TripRosterPage = lazy(() =>
	import("../features/booking-members/pages/TripRosterPage").then((module) => ({
		default: module.TripRosterPage,
	}))
);
const CamperProfilePage = lazy(() =>
	import("../features/camper-profile/pages/CamperProfilePage").then((module) => ({
		default: module.CamperProfilePage,
	}))
);
const EquipmentCatalogPage = lazy(() =>
	import("../features/equipment-catalog/pages/EquipmentCatalogPage").then((module) => ({
		default: module.EquipmentCatalogPage,
	}))
);
const LandingPage = lazy(() =>
	import("../features/landing/pages/LandingPage").then((module) => ({
		default: module.LandingPage,
	}))
);
const PorterProfilePage = lazy(() =>
	import("../features/porter-profile/pages/PorterProfilePage").then((module) => ({
		default: module.PorterProfilePage,
	}))
);
const PorterVerificationGate = lazy(() =>
	import("../features/porter-verification/components/PorterVerificationGate").then((module) => ({
		default: module.PorterVerificationGate,
	}))
);
const PorterVerificationPage = lazy(() =>
	import("../features/porter-verification/pages/PorterVerificationPage").then((module) => ({
		default: module.PorterVerificationPage,
	}))
);
const HostLayout = lazy(() =>
	import("../features/role-landing/components/HostLayout").then((module) => ({
		default: module.HostLayout,
	}))
);
const PorterAssignedTripDetail = lazy(() =>
	import("../features/role-landing/components/PorterAssignedTripDetail").then((module) => ({
		default: module.PorterAssignedTripDetail,
	}))
);
const PorterAssignedTripsPanel = lazy(() =>
	import("../features/role-landing/components/PorterAssignedTripsPanel").then((module) => ({
		default: module.PorterAssignedTripsPanel,
	}))
);
const RoleLandingPage = lazy(() =>
	import("../features/role-landing/pages/RoleLandingPage").then((module) => ({
		default: module.RoleLandingPage,
	}))
);
const AdminSettlementsPage = lazy(() =>
	import("../features/settlements/pages/AdminSettlementsPage").then((module) => ({
		default: module.AdminSettlementsPage,
	}))
);
const HostWalletPage = lazy(() =>
	import("../features/settlements/pages/HostWalletPage").then((module) => ({
		default: module.HostWalletPage,
	}))
);
const AdminTrekkingRoutesPage = lazy(() =>
	import("../features/trekking-routes/pages/AdminTrekkingRoutesPage").then((module) => ({
		default: module.AdminTrekkingRoutesPage,
	}))
);
const CreateTrekkingRoutePage = lazy(() =>
	import("../features/trekking-routes/pages/CreateTrekkingRoutePage").then((module) => ({
		default: module.CreateTrekkingRoutePage,
	}))
);
const TrekkingRouteDetailPage = lazy(() =>
	import("../features/trekking-routes/pages/TrekkingRouteDetailPage").then((module) => ({
		default: module.TrekkingRouteDetailPage,
	}))
);
const TrekkingRoutesPage = lazy(() =>
	import("../features/trekking-routes/pages/TrekkingRoutesPage").then((module) => ({
		default: module.TrekkingRoutesPage,
	}))
);
const AdminTripsPage = lazy(() =>
	import("../features/trips/pages/AdminTripsPage").then((module) => ({
		default: module.AdminTripsPage,
	}))
);
const CreateTripPage = lazy(() =>
	import("../features/trips/pages/CreateTripPage").then((module) => ({
		default: module.CreateTripPage,
	}))
);
const HostCampersPage = lazy(() =>
	import("../features/trips/pages/HostCampersPage").then((module) => ({
		default: module.HostCampersPage,
	}))
);
const HostPorterRequestsPage = lazy(() =>
	import("../features/trips/pages/HostPorterRequestsPage").then((module) => ({
		default: module.HostPorterRequestsPage,
	}))
);
const PorterRequestsPage = lazy(() =>
	import("../features/trips/pages/PorterRequestsPage").then((module) => ({
		default: module.PorterRequestsPage,
	}))
);
const SearchTripsPage = lazy(() =>
	import("../features/trips/pages/SearchTripsPage").then((module) => ({
		default: module.SearchTripsPage,
	}))
);
const TripDetailPage = lazy(() =>
	import("../features/trips/pages/TripDetailPage").then((module) => ({
		default: module.TripDetailPage,
	}))
);
const EdgeCasePage = lazy(() =>
	import("../shared/pages/EdgeCasePage").then((module) => ({ default: module.EdgeCasePage }))
);
const ErrorPage = lazy(() =>
	import("../shared/pages/ErrorPage").then((module) => ({ default: module.ErrorPage }))
);
const NotFoundPage = lazy(() =>
	import("../shared/pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage }))
);
const UnauthorizedPage = lazy(() =>
	import("../shared/pages/UnauthorizedPage").then((module) => ({
		default: module.UnauthorizedPage,
	}))
);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AppRoutes() {
	return (
		<Suspense fallback={<PageSkeleton />}>
			<AppRouteContent />
		</Suspense>
	);
}

function AppRouteContent() {
	const [currentPath, setCurrentPath] = useState<string>(() => {
		if (window.location.hash) {
			const hashPath = window.location.hash.replace("#", "/");
			window.history.replaceState({}, "", hashPath);
			return hashPath.toLowerCase();
		}
		return window.location.pathname.toLowerCase();
	});
	const [currentSearch, setCurrentSearch] = useState(() => window.location.search);
	const [restoredTripBooking, setRestoredTripBooking] = useState<BookingDetails | null>(null);

	useEffect(() => {
		const handleLocationChange = () =>
			guardedNavigation(() => {
				setCurrentPath(window.location.pathname.toLowerCase());
				setCurrentSearch(window.location.search);
			});

		window.addEventListener("popstate", handleLocationChange);
		return () => {
			window.removeEventListener("popstate", handleLocationChange);
		};
	}, []);

	const navigateTo = (path: string) =>
		guardedNavigation(() => {
			const normalizedPath = path.startsWith("/") ? path : `/${path}`;
			const nextLocation = new URL(normalizedPath, window.location.origin);
			window.history.pushState({}, "", normalizedPath);
			setCurrentPath(nextLocation.pathname.toLowerCase());
			setCurrentSearch(nextLocation.search);
		});
	const handleBookingLoaded = useCallback((booking: BookingDetails) => {
		setRestoredTripBooking(booking);
	}, []);

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
	const shouldCanonicalizePorterProfile =
		(currentPath === RoutePath.CAMPER_PROFILE || currentPath === RoutePath.PROFILE) &&
		currentRoles.includes("porter") &&
		!currentRoles.includes("camper");
	useIdleLogout(storedUser !== null, () => {
		// Always end the session, even if the logout request itself fails.
		handleLogout(false).catch(() => clearAuthSessionAndRedirect());
	});
	const isCheckingSession = useSessionCheck(storedUser !== null);
	const isPorterOnly =
		currentRoles.includes("porter") && currentRoles.every((role) => role === "porter");
	// Porter features stay locked until an Admin approves the guide certificate documents.
	const withPorterVerification = (page: ReactNode): ReactNode =>
		storedUser && currentRoles.includes("porter") ? (
			<PorterVerificationGate
				porterId={storedUser.id}
				onRequireVerification={() => {
					window.history.replaceState({}, "", RoutePath.PORTER_VERIFICATION);
					setCurrentPath(RoutePath.PORTER_VERIFICATION);
					setCurrentSearch("");
				}}
			>
				{page}
			</PorterVerificationGate>
		) : (
			page
		);
	const guestOnlyRedirectPath = isCheckingSession
		? null
		: getGuestOnlyRedirectPath(currentPath, storedUser);

	useEffect(() => {
		if (!guestOnlyRedirectPath) {
			return;
		}
		// replaceState (not pushState) so Back does not bounce the user onto the guest page again.
		window.history.replaceState({}, "", guestOnlyRedirectPath);
		setCurrentPath(guestOnlyRedirectPath);
		setCurrentSearch("");
	}, [guestOnlyRedirectPath]);

	useEffect(() => {
		if (!shouldCanonicalizePorterProfile) return;
		window.history.replaceState({}, "", RoutePath.PORTER_PROFILE);
		setCurrentPath(RoutePath.PORTER_PROFILE);
		setCurrentSearch("");
	}, [shouldCanonicalizePorterProfile]);

	const unauthorizedFallback = (
		<UnauthorizedPage
			requiredRole="admin"
			onBackToHome={() => navigateTo(RoutePath.HOME)}
			onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
		/>
	);
	const camperUnauthorizedFallback = (
		<UnauthorizedPage
			requiredRole="camper"
			onBackToHome={() => navigateTo(RoutePath.HOME)}
			onNavigateToLogin={() => navigateTo(RoutePath.LOGIN)}
		/>
	);
	// Only guest-only pages wait for the check (they must decide where to send the user);
	// in-app pages render immediately while the session is validated in the background.
	if (isCheckingSession && GUEST_ONLY_PATHS.has(currentPath)) {
		return <SessionCheckScreen />;
	}
	if (guestOnlyRedirectPath) {
		return null;
	}
	if (shouldCanonicalizePorterProfile) {
		return null;
	}
	if (currentPath === RoutePath.BOOKINGS) {
		return (
			<AppRoleGuard
				allowedRoles={["camper"]}
				currentRoles={currentRoles}
				fallback={camperUnauthorizedFallback}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
					<BookingListPage
						onViewDetails={(bookingId) => navigateTo(`/bookings/${bookingId}?from=bookings`)}
					/>
				</HostLayout>
			</AppRoleGuard>
		);
	}

	const porterAssignmentPrefix = `${RoutePath.PORTER_ASSIGNMENTS}/`;
	if (currentPath.startsWith(porterAssignmentPrefix)) {
		const tripId = currentPath.slice(porterAssignmentPrefix.length);
		return (
			<AppRoleGuard
				allowedRoles={["porter"]}
				currentRoles={currentRoles}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				{withPorterVerification(
					<HostLayout
						activeRole="porter"
						onLogout={handleLogout}
						onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
					>
						<main className="p-4 sm:p-6 lg:p-8">
							{UUID_PATTERN.test(tripId) ? (
								<PorterAssignedTripDetail
									tripId={tripId}
									onBack={() => navigateTo(RoutePath.PORTER_ASSIGNMENTS)}
								/>
							) : (
								<NotFoundPage onBackToHome={() => navigateTo(RoutePath.PORTER_ASSIGNMENTS)} />
							)}
						</main>
					</HostLayout>
				)}
			</AppRoleGuard>
		);
	}

	const trekkingRoutePrefix = `${RoutePath.HOST_TREKKING_ROUTES}/`;
	if (
		currentPath.startsWith(trekkingRoutePrefix) &&
		currentPath !== RoutePath.HOST_CREATE_TREKKING_ROUTE
	) {
		const [routeId, action] = currentPath.slice(trekkingRoutePrefix.length).split("/");
		const isEdit = action === "edit";
		const valid = UUID_PATTERN.test(routeId) && (action === undefined || isEdit);
		return (
			<AppRoleGuard
				allowedRoles={["host"]}
				currentRoles={currentRoles}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
					{!valid ? (
						<NotFoundPage onBackToHome={() => navigateTo(RoutePath.HOST_TREKKING_ROUTES)} />
					) : isEdit ? (
						<CreateTrekkingRoutePage
							routeId={routeId}
							onViewRouteDetail={(id) => navigateTo(`${trekkingRoutePrefix}${id}`)}
						/>
					) : (
						<TrekkingRouteDetailPage
							routeId={routeId}
							onBack={() => navigateTo(RoutePath.HOST_TREKKING_ROUTES)}
							onEdit={(id) => navigateTo(`${trekkingRoutePrefix}${id}/edit`)}
						/>
					)}
				</HostLayout>
			</AppRoleGuard>
		);
	}

	if (currentPath.startsWith("/host/trips/") && currentPath.endsWith("/edit")) {
		const tripId = currentPath.slice("/host/trips/".length, -"/edit".length);
		return (
			<AppRoleGuard
				allowedRoles={["host"]}
				currentRoles={currentRoles}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
					<CreateTripPage
						key={tripId}
						onEditTripInfo={(id) => navigateTo(`/host/trips/${id}/edit`)}
						editTripId={tripId.startsWith("form-") ? undefined : tripId}
						formDraftId={tripId.startsWith("form-") ? tripId.slice(5) : undefined}
						onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
						onCreateRoute={() => navigateTo(RoutePath.HOST_CREATE_TREKKING_ROUTE)}
					/>
				</HostLayout>
			</AppRoleGuard>
		);
	}

	const isBookingDetailRoute = currentPath.startsWith("/bookings/") && currentPath !== "/bookings/";
	const bookingId = isBookingDetailRoute ? currentPath.substring("/bookings/".length) : null;
	const isTripDetailRoute = currentPath.startsWith("/trips/") && currentPath !== RoutePath.TRIPS;
	const routeTripId = isTripDetailRoute ? currentPath.substring("/trips/".length) : null;
	const navigationContext = new URLSearchParams(currentSearch);
	const contextTripId = navigationContext.get("tripId");
	const tripReturnId =
		isBookingDetailRoute &&
		navigationContext.get("from") === "trip" &&
		contextTripId &&
		UUID_PATTERN.test(contextTripId)
			? contextTripId
			: null;
	const activeTripId = routeTripId ?? tripReturnId;
	const isBookingFromTrip = Boolean(bookingId && tripReturnId);
	const isOperationalRosterRoute =
		Boolean(routeTripId) && navigationContext.get("view") === "roster";
	const isPorterCheckInRoster =
		isOperationalRosterRoute && navigationContext.get("from") === "porter-checkins";

	if (activeTripId) {
		if (isOperationalRosterRoute) {
			return (
				<AppRoleGuard
					allowedRoles={["host", "porter"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout
						activeRole={
							isPorterCheckInRoster && currentRoles.includes("porter") ? "porter" : undefined
						}
						onLogout={handleLogout}
						onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
					>
						<TripRosterPage
							tripId={activeTripId}
							onBack={() =>
								navigateTo(
									isPorterCheckInRoster
										? `${RoutePath.PORTER_ASSIGNMENTS}?view=checkins`
										: RoutePath.DASHBOARD
								)
							}
							backLabel={isPorterCheckInRoster ? "Quay lại chọn chuyến đi" : undefined}
						/>
					</HostLayout>
				</AppRoleGuard>
			);
		}
		const detailView = (
			<TripDetailPage
				tripId={activeTripId}
				onBackToList={() => navigateTo(RoutePath.TRIPS)}
				onBackHome={() => navigateTo(storedUser ? RoutePath.DASHBOARD : RoutePath.HOME)}
				canManageTrips={currentRoles.includes("host")}
				currentUserId={storedUser?.id ?? null}
				bookingAccess={
					!storedUser ? "anonymous" : currentRoles.includes("camper") ? "camper" : "non-camper"
				}
				onSignIn={() => navigateTo(RoutePath.LOGIN)}
				onEditTrip={(tripId) => navigateTo(`/host/trips/${tripId}/edit`)}
				onManagePorters={(tripId) =>
					navigateTo(`${RoutePath.HOST_PORTER}?tripId=${encodeURIComponent(tripId)}`)
				}
				onViewBookingDetails={(selectedBookingId) =>
					navigateTo(
						`/bookings/${selectedBookingId}?from=trip&tripId=${encodeURIComponent(activeTripId)}`
					)
				}
				restoredBookingDetails={restoredTripBooking}
				onClearRestoredBooking={() => setRestoredTripBooking(null)}
				showOperationalRoster={currentRoles.includes("host") || currentRoles.includes("porter")}
			/>
		);
		const tripFlow = (
			<>
				<div hidden={isBookingFromTrip} aria-hidden={isBookingFromTrip || undefined}>
					{detailView}
				</div>
				{isBookingFromTrip && bookingId && (
					<BookingDetailsPage
						bookingId={bookingId}
						onBack={() => navigateTo(`/trips/${activeTripId}`)}
						backLabel="Quay lại chi tiết chuyến đi"
						onBookingLoaded={handleBookingLoaded}
					/>
				)}
			</>
		);

		if (storedUser) {
			return (
				<AppRoleGuard
					allowedRoles={isBookingFromTrip ? ["camper"] : ["camper", "host", "porter", "admin"]}
					currentRoles={currentRoles}
					fallback={camperUnauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						{tripFlow}
					</HostLayout>
				</AppRoleGuard>
			);
		}
		if (isBookingFromTrip) {
			return (
				<AppRoleGuard
					allowedRoles={["camper"]}
					currentRoles={currentRoles}
					fallback={camperUnauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					{tripFlow}
				</AppRoleGuard>
			);
		}

		return tripFlow;
	}

	if (isBookingDetailRoute && bookingId) {
		return (
			<AppRoleGuard
				allowedRoles={["camper"]}
				currentRoles={currentRoles}
				fallback={camperUnauthorizedFallback}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
					<BookingDetailsPage
						bookingId={bookingId}
						onBack={() => navigateTo(RoutePath.BOOKINGS)}
						backLabel="Quay lại đơn đặt chỗ"
					/>
				</HostLayout>
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
						navigateTo(getAuthenticatedHomePath(user));
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

		case RoutePath.PORTER_PROFILE:
			return (
				<AppRoleGuard
					allowedRoles={["porter"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					{withPorterVerification(
						<HostLayout
							activeRole="porter"
							onLogout={handleLogout}
							onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
						>
							<PorterProfilePage
								onBackHome={() => navigateTo(storedUser ? RoutePath.DASHBOARD : RoutePath.HOME)}
								onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
								onLogout={handleLogout}
							/>
						</HostLayout>
					)}
				</AppRoleGuard>
			);

		case RoutePath.PORTER_VERIFICATION:
			return (
				<AppRoleGuard
					allowedRoles={["porter"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<PorterVerificationPage
						onLogout={handleLogout}
						onContinue={() => navigateTo(RoutePath.DASHBOARD)}
					/>
				</AppRoleGuard>
			);

		case RoutePath.PORTER_ASSIGNMENTS: {
			const isCheckInSelection = navigationContext.get("view") === "checkins";
			return (
				<AppRoleGuard
					allowedRoles={["porter"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					{withPorterVerification(
						<HostLayout
							activeRole="porter"
							onLogout={handleLogout}
							onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
						>
							<main className="p-4 sm:p-6 lg:p-8">
								<PorterAssignedTripsPanel
									mode={isCheckInSelection ? "checkins" : "assignments"}
									onViewTripDetail={(tripId) =>
										navigateTo(`${RoutePath.PORTER_ASSIGNMENTS}/${tripId}`)
									}
									onOpenRoster={(tripId) =>
										navigateTo(`/trips/${tripId}?view=roster&from=porter-checkins`)
									}
								/>
							</main>
						</HostLayout>
					)}
				</AppRoleGuard>
			);
		}

		case RoutePath.PORTER_REQUESTS:
			return (
				<AppRoleGuard
					allowedRoles={["porter"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					{withPorterVerification(
						<HostLayout
							onLogout={handleLogout}
							onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
						>
							<PorterRequestsPage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
						</HostLayout>
					)}
				</AppRoleGuard>
			);

		case RoutePath.CAMPER_PROFILE:
		case RoutePath.PROFILE:
			return (
				<CamperProfilePage
					onBackHome={() => navigateTo(storedUser ? RoutePath.DASHBOARD : RoutePath.HOME)}
					onNavigateDashboard={() => navigateTo(RoutePath.DASHBOARD)}
					onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
					onNavigateToBookings={() => navigateTo(RoutePath.BOOKINGS)}
					onLogout={handleLogout}
				/>
			);

		case RoutePath.HOST_CREATE_TREKKING_ROUTE:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<CreateTrekkingRoutePage
							onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
							onViewRouteDetail={(id) => navigateTo(`${RoutePath.HOST_TREKKING_ROUTES}/${id}`)}
						/>
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.TRIPS: {
			const searchView = (
				<SearchTripsPage
					onBackHome={() => navigateTo(storedUser ? RoutePath.DASHBOARD : RoutePath.HOME)}
					onNavigateToTripDetail={(tripId) => navigateTo(`/trips/${tripId}`)}
				/>
			);

			if (storedUser) {
				return (
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						{searchView}
					</HostLayout>
				);
			}

			return searchView;
		}

		case RoutePath.HOST_CREATE_TRIP:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<CreateTripPage
							key="new-trip"
							onEditTripInfo={(id) => navigateTo(`/host/trips/${id}/edit`)}
							onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
							onCreateRoute={() => navigateTo(RoutePath.HOST_CREATE_TREKKING_ROUTE)}
						/>
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.HOST_PORTER:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<HostPorterRequestsPage
							initialTripId={navigationContext.get("tripId")}
							initialView={navigationContext.get("view")}
						/>
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.HOST_CAMPERS:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<HostCampersPage
							initialTripId={navigationContext.get("tripId")}
							onNavigateToTripDetail={(tripId) => navigateTo(`/trips/${tripId}`)}
							onCreateTrip={() => navigateTo(RoutePath.HOST_CREATE_TRIP)}
						/>
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
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<TrekkingRoutesPage
							onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
							onViewRouteDetail={(id) => navigateTo(`${RoutePath.HOST_TREKKING_ROUTES}/${id}`)}
						/>
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.HOST_EQUIPMENT_CATALOG:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<EquipmentCatalogPage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.HOST_WALLET:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<HostWalletPage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
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

			const roleLanding = (
				<RoleLandingPage
					user={storedUser}
					roles={currentRoles}
					onBackHome={() => navigateTo(RoutePath.HOME)}
					onOpenProfile={(activeRole) =>
						navigateTo(
							activeRole === "porter" ? RoutePath.PORTER_PROFILE : RoutePath.CAMPER_PROFILE
						)
					}
					onOpenAdminUsers={() => navigateTo(RoutePath.ADMIN_USERS)}
					onExplore={() => navigateTo(RoutePath.TRIPS)}
					onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
					onNavigateToBookings={() => navigateTo(RoutePath.BOOKINGS)}
					onNavigateToTripDetail={(tripId) => navigateTo(`/trips/${tripId}`)}
					onCreateTrip={() => navigateTo(RoutePath.HOST_CREATE_TRIP)}
					onEditTripDraft={(tripId) => navigateTo(`/host/trips/${tripId}/edit`)}
					onCreateTrekkingRoute={() => navigateTo(RoutePath.HOST_CREATE_TREKKING_ROUTE)}
					onViewTrekkingRoutes={() => navigateTo(RoutePath.HOST_TREKKING_ROUTES)}
					onLogout={handleLogout}
				/>
			);
			return isPorterOnly ? withPorterVerification(roleLanding) : roleLanding;
		}

		case RoutePath.ADMIN_PORTER_LEVELS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminPorterLevelsPage onLogout={handleLogout} />
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_PORTER_VERIFICATIONS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminPorterVerificationsPage onLogout={handleLogout} />
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_USERS:
		case RoutePath.ADMIN_CONTENT_REPORTS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					{currentPath === RoutePath.ADMIN_CONTENT_REPORTS ? (
						<AdminContentReportsPage onLogout={handleLogout} />
					) : (
						<AdminUserAccountsPage onLogout={handleLogout} />
					)}
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

		case RoutePath.ADMIN_TRIPS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminTripsPage onLogout={handleLogout} />
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

		case RoutePath.ADMIN_REFUNDS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminRefundsPage onLogout={handleLogout} />
				</AppRoleGuard>
			);

		case RoutePath.ADMIN_SETTLEMENTS:
			return (
				<AppRoleGuard
					allowedRoles={["admin"]}
					currentRoles={currentRoles}
					fallback={unauthorizedFallback}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<AdminSettlementsPage onLogout={handleLogout} />
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
