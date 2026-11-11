import type React from "react";
import { LoginForm } from "../components/LoginForm";
import { LoginHeroBanner } from "../components/LoginHeroBanner";
import type { LoginPageProps } from "../types";

export const LoginPage: React.FC<LoginPageProps> = ({
	onBackToHome,
	onNavigateToRegister,
	onNavigateToForgotPassword,
	onLoginSuccess,
}) => {
	return (
		<div className="flex h-screen w-full overflow-y-auto lg:overflow-hidden bg-[#f8faf7] font-sans text-[#10221b] antialiased">
			<LoginHeroBanner />
			<LoginForm
				onBackToHome={onBackToHome}
				onNavigateToRegister={onNavigateToRegister}
				onNavigateToForgotPassword={onNavigateToForgotPassword}
				onLoginSuccess={onLoginSuccess}
			/>
		</div>
	);
};
