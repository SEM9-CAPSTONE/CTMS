import { ArrowLeft } from "lucide-react";
import type React from "react";
import { Button } from "../../../shared/components";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { Footer } from "../../landing/components/Footer";
import { HeaderNav } from "../../landing/components/HeaderNav";

export interface PublicPageProps {
	onBackToHome: () => void;
	onNavigateToLogin: () => void;
	onNavigateToRegister: () => void;
	onNavigateToDashboard?: () => void;
	onNavigateToPath: (path: string) => void;
}

interface PublicPageLayoutProps {
	eyebrow: string;
	title: string;
	subtitle?: string;
	headerAction?: React.ReactNode;
	onBackToHome: () => void;
	onNavigateToLogin: () => void;
	onNavigateToRegister: () => void;
	onNavigateToDashboard?: () => void;
	children: React.ReactNode;
}

export const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({
	eyebrow,
	title,
	subtitle,
	headerAction,
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	children,
}) => {
	const storedUser = getStoredAuthUser();

	return (
		<div className="min-h-screen bg-[#f4f7f2] px-5 py-6 font-sans text-[#10221b] antialiased">
			<div className="mx-auto max-w-[1240px]">
				{storedUser ? (
					<header className="mb-10 flex flex-wrap items-center justify-between gap-4">
						<button
							type="button"
							onClick={onNavigateToDashboard ?? onBackToHome}
							className="flex cursor-pointer items-center gap-3 text-2xl font-extrabold tracking-tight text-[#164027]"
						>
							<img src="/ctms_logo.png" alt="Logo DiTrek" className="h-13 w-auto object-contain" />
							<span>DiTrek</span>
						</button>
						<div className="flex items-center gap-3">
							<Button variant="outline" size="sm" onClick={onNavigateToDashboard ?? onBackToHome}>
								<ArrowLeft className="mr-1.5 size-4" />
								Quay lại bảng điều khiển
							</Button>
						</div>
					</header>
				) : (
					<HeaderNav
						onNavigateToLogin={onNavigateToLogin}
						onNavigateToRegister={onNavigateToRegister}
					/>
				)}

				<section className="rounded-3xl border border-[#dfe8df] bg-white px-6 py-7 shadow-xs sm:px-8 sm:py-8">
					<div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
						<div className="max-w-3xl space-y-2">
							<p className="text-xs font-semibold tracking-wide text-[#2d5a27]">{eyebrow}</p>
							<h1 className="text-2xl font-extrabold tracking-tight text-[#10221b] sm:text-3xl">
								{title}
							</h1>
							{subtitle && <p className="text-sm leading-relaxed text-[#425048]">{subtitle}</p>}
						</div>
						{headerAction && <div className="shrink-0">{headerAction}</div>}
					</div>
				</section>

				<main className="mt-6 pb-14">{children}</main>

				<Footer />
			</div>
		</div>
	);
};
