import { useEffect, useState } from "react";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { VerifyOtpPage } from "../features/auth/pages/VerifyOtpPage";
import { CamperProfilePage } from "../features/camper-profile/pages/CamperProfilePage";
import { LandingPage } from "../features/landing/pages/LandingPage";
import { EdgeCasePage, ErrorPage, NotFoundPage, UnauthorizedPage } from "../shared/pages";
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
			return <CamperProfilePage onBackHome={() => navigateTo(RoutePath.HOME)} />;

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
