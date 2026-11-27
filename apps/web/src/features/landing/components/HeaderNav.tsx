import type React from "react";
import { handlePublicLinkClick } from "../../public-pages/utils/spaNavigate";
import { NAV_ITEMS } from "../constants";

interface HeaderNavProps {
	onNavigateToLogin: () => void;
	onNavigateToRegister: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
	onNavigateToLogin,
	onNavigateToRegister,
}) => {
	const currentPath = typeof window !== "undefined" ? window.location.pathname.toLowerCase() : "/";

	return (
		<header className="mb-10 flex flex-wrap items-center justify-between gap-5">
			<div className="flex flex-wrap items-center gap-6 md:gap-9">
				<a
					href="/"
					onClick={(event) => handlePublicLinkClick(event, "/")}
					className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-[#1c442f]"
				>
					<img src="/ctms_logo.png" alt="CTMS Logo" className="h-13 w-auto object-contain" />
					<span>CTMS</span>
				</a>
				<nav className="flex flex-wrap items-center gap-5 md:gap-7" aria-label="Điều hướng chính">
					{NAV_ITEMS.map((item) => {
						const isActive =
							item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href);
						return (
							<a
								key={item.label}
								href={item.href}
								onClick={(event) => handlePublicLinkClick(event, item.href)}
								aria-current={isActive ? "page" : undefined}
								className={`text-sm font-semibold transition ${
									isActive
										? "text-[#164027] underline underline-offset-8"
										: "text-[#2f4c40] hover:text-[#1c442f]"
								}`}
							>
								{item.label}
							</a>
						);
					})}
				</nav>
			</div>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onNavigateToLogin}
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#1c442f]/20 bg-transparent px-6 py-3 text-sm font-semibold text-[#1c442f] transition hover:-translate-y-0.5 hover:bg-[#1c442f]/5"
				>
					Đăng nhập
				</button>
				<button
					type="button"
					onClick={onNavigateToRegister}
					className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1c442f] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#143323] hover:shadow-md"
				>
					Đăng ký
				</button>
			</div>
		</header>
	);
};
