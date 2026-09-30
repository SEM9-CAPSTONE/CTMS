import { useCallback, useEffect, useState } from "react";
import { HttpError } from "../core/api";
import { clearAuthSessionAndRedirect } from "../core/api/authSessionSync";
import { AdminAuditLogsPage } from "../features/admin-audit-logs/pages/AdminAuditLogsPage";
import { AdminContentReportsPage } from "../features/admin-content-reports/pages/AdminContentReportsPage";
import { AdminUserAccountsPage } from "../features/admin-user-accounts/pages/AdminUserAccountsPage";
import { AdminWeatherRulesPage } from "../features/admin-weather-rules/pages/AdminWeatherRulesPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { VerifyOtpPage } from "../features/auth/pages/VerifyOtpPage";
import { authService } from "../features/auth/services/auth.service";
import { getGrantedRoles, isAdminUser } from "../features/auth/utils/permissions";
import { getRefreshToken, getStoredAuthUser } from "../features/auth/utils/tokenStorage";
import { BookingDetailsPage } from "../features/booking-details/pages/BookingDetailsPage";
import type { BookingDetails } from "../features/booking-details/types";
import { BookingListPage } from "../features/booking-list/pages/BookingListPage";
import { CamperProfilePage } from "../features/camper-profile/pages/CamperProfilePage";
import { CreateEquipmentCatalogItemPage } from "../features/equipment-catalog/pages/CreateEquipmentCatalogItemPage";
import { EquipmentCatalogPage } from "../features/equipment-catalog/pages/EquipmentCatalogPage";
import { LandingPage } from "../features/landing/pages/LandingPage";
import { PackingListPage } from "../features/packing-list/pages/PackingListPage";
import { HostLayout } from "../features/role-landing/components/HostLayout";
import { RoleLandingPage } from "../features/role-landing/pages/RoleLandingPage";
import { AdminTrekkingRoutesPage } from "../features/trekking-routes/pages/AdminTrekkingRoutesPage";
import { CreateTrekkingRoutePage } from "../features/trekking-routes/pages/CreateTrekkingRoutePage";
import { TrekkingRoutesPage } from "../features/trekking-routes/pages/TrekkingRoutesPage";
import { AdminTripsPage } from "../features/trips/pages/AdminTripsPage";
import { CreateTripPage } from "../features/trips/pages/CreateTripPage";
import { SearchTripsPage } from "../features/trips/pages/SearchTripsPage";
import { TripDetailPage } from "../features/trips/pages/TripDetailPage";
import { EdgeCasePage, ErrorPage, NotFoundPage, UnauthorizedPage } from "../shared/pages";
import { AppRoleGuard } from "./AppRoleGuard";
import { RoutePath } from "./routes.config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AppRoutes() {
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
		const handleLocationChange = () => {
			setCurrentPath(window.location.pathname.toLowerCase());
			setCurrentSearch(window.location.search);
		};

		window.addEventListener("popstate", handleLocationChange);
		return () => {
			window.removeEventListener("popstate", handleLocationChange);
		};
	}, []);

	const navigateTo = (path: string) => {
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		const nextLocation = new URL(normalizedPath, window.location.origin);
		window.history.pushState({}, "", normalizedPath);
		setCurrentPath(nextLocation.pathname.toLowerCase());
		setCurrentSearch(nextLocation.search);
	};
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
						editTripId={tripId}
						onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
						onCreateRoute={() => navigateTo(RoutePath.HOST_CREATE_TREKKING_ROUTE)}
					/>
				</HostLayout>
			</AppRoleGuard>
		);
	}

	if (currentPath.startsWith("/bookings/") && currentPath.endsWith("/packing-list")) {
		const bookingId = currentPath.slice("/bookings/".length, -"/packing-list".length);
		return (
			<AppRoleGuard
				allowedRoles={["camper"]}
				currentRoles={currentRoles}
				onNavigateHome={() => navigateTo(RoutePath.HOME)}
			>
				<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
					<PackingListPage bookingId={bookingId} onBack={() => window.history.back()} />
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

	if (activeTripId) {
		const detailView = (
			<TripDetailPage
				tripId={activeTripId}
				onBackToList={() => navigateTo(RoutePath.TRIPS)}
				onBackHome={() => navigateTo(storedUser ? RoutePath.DASHBOARD : RoutePath.HOME)}
				bookingAccess={
					!storedUser ? "anonymous" : currentRoles.includes("camper") ? "camper" : "non-camper"
				}
				onSignIn={() => navigateTo(RoutePath.LOGIN)}
				onViewPackingList={(bookingId) => navigateTo(`/bookings/${bookingId}/packing-list`)}
				onViewBookingDetails={(selectedBookingId) =>
					navigateTo(
						`/bookings/${selectedBookingId}?from=trip&tripId=${encodeURIComponent(activeTripId)}`
					)
				}
				restoredBookingDetails={restoredTripBooking}
				onClearRestoredBooking={() => setRestoredTripBooking(null)}
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
					onBackHome={() => navigateTo(storedUser ? RoutePath.DASHBOARD : RoutePath.HOME)}
					onNavigateDashboard={() => navigateTo(RoutePath.DASHBOARD)}
					onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}
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
						<CreateTrekkingRoutePage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
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
							onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
							onCreateRoute={() => navigateTo(RoutePath.HOST_CREATE_TREKKING_ROUTE)}
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
						<TrekkingRoutesPage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
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
						<EquipmentCatalogPage
							onBackHome={() => navigateTo(RoutePath.DASHBOARD)}
							onCreateItem={() => navigateTo(RoutePath.HOST_CREATE_EQUIPMENT_CATALOG_ITEM)}
						/>
					</HostLayout>
				</AppRoleGuard>
			);

		case RoutePath.HOST_CREATE_EQUIPMENT_CATALOG_ITEM:
			return (
				<AppRoleGuard
					allowedRoles={["host"]}
					currentRoles={currentRoles}
					onNavigateHome={() => navigateTo(RoutePath.HOME)}
				>
					<HostLayout onLogout={handleLogout} onNavigateToTrips={() => navigateTo(RoutePath.TRIPS)}>
						<CreateEquipmentCatalogItemPage onBackHome={() => navigateTo(RoutePath.DASHBOARD)} />
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
		}

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
